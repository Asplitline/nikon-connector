import { useCallback, useEffect, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { type Locale, t } from "../../i18n";
import {
  checkForUpdate,
  exportLogs,
  getAppInfo,
  getLogInfo,
  installPendingUpdate,
  writeAppLog,
  type AppInfo,
  type LogInfo,
} from "../../lib/appApi";
import { formatBytes } from "../../lib/format";
import type { LogStatus, UpdateStatus } from "./uiTypes";

export interface AppUpdates {
  appInfo: AppInfo | null;
  autoUpdateEnabled: boolean;
  checkNow: () => Promise<void>;
  exportLogBundle: () => Promise<void>;
  installUpdate: () => Promise<void>;
  logInfo: LogInfo | null;
  logStatus: LogStatus;
  setAutoUpdateEnabled: (enabled: boolean) => void;
  updateStatus: UpdateStatus;
}

// 应用信息、更新检查与安装、诊断日志导出
export function useAppUpdates(
  locale: Locale,
  onStatusMessage: (message: string) => void,
): AppUpdates {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [logInfo, setLogInfo] = useState<LogInfo | null>(null);
  const [logStatus, setLogStatus] = useState<LogStatus>("idle");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
    message: t("status.notChecked"),
  });

  const tr = useCallback(
    (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) =>
      t(key, values, locale),
    [locale],
  );

  useEffect(() => {
    void getAppInfo()
      .then(setAppInfo)
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : tr("status.couldNotReadAppInfo");
        setUpdateStatus({ state: "error", message });
        writeAppLog("error", "frontend.app_info", message);
      });
  }, [tr]);

  useEffect(() => {
    void getLogInfo()
      .then(setLogInfo)
      .catch((error) => {
        writeAppLog(
          "error",
          "frontend.logs",
          error instanceof Error ? error.message : tr("status.couldNotReadLogs"),
        );
      });
  }, [tr]);

  const checkNow = useCallback(async () => {
    setUpdateStatus({ state: "checking", message: tr("status.updateChecking") });

    try {
      const update = await checkForUpdate();

      if (!update) {
        setUpdateStatus({ state: "idle", message: tr("status.noUpdate") });
        return;
      }

      setUpdateStatus({
        state: "available",
        message: tr("status.updateAvailable", { version: update.version }),
        update,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.updateCheckFailed");
      setUpdateStatus({ state: "error", message });
      writeAppLog("error", "frontend.update", message);
    }
  }, [tr]);

  useEffect(() => {
    if (!autoUpdateEnabled || !appInfo) {
      return;
    }

    void Promise.resolve().then(checkNow);
  }, [appInfo, autoUpdateEnabled, checkNow]);

  const installUpdate = useCallback(async () => {
    setUpdateStatus({ state: "installing", message: tr("status.downloading") });

    try {
      await installPendingUpdate((event) => {
        if (event.event === "Started") {
          setUpdateStatus({
            state: "installing",
            message: event.data.contentLength
              ? tr("status.downloadingSize", {
                  size: formatBytes(event.data.contentLength),
                })
              : tr("status.downloading"),
          });
          return;
        }

        if (event.event === "Finished") {
          setUpdateStatus({ state: "installing", message: tr("status.installing") });
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.updateInstallFailed");
      setUpdateStatus({ state: "error", message });
      writeAppLog("error", "frontend.update", message);
    }
  }, [tr]);

  const exportLogBundle = useCallback(async () => {
    setLogStatus("exporting");

    try {
      const path = await exportLogs();
      const nextInfo = await getLogInfo();
      setLogInfo(nextInfo);
      setLogStatus("idle");
      onStatusMessage(tr("status.logsExported", { path }));
      await openPath(path);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.logsExportFailed");
      setLogStatus("error");
      onStatusMessage(message);
      writeAppLog("error", "frontend.logs", message);
    }
  }, [onStatusMessage, tr]);

  return {
    appInfo,
    autoUpdateEnabled,
    checkNow,
    exportLogBundle,
    installUpdate,
    logInfo,
    logStatus,
    setAutoUpdateEnabled,
    updateStatus,
  };
}
