import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

export interface AppInfo {
  name: string;
  version: string;
  changelog: string;
  updateEndpoint: string;
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
}

export interface LogInfo {
  exportPath: string;
  logPath: string;
  sizeBytes: number;
}

export type LogLevel = "info" | "warn" | "error";

let pendingUpdate: Update | null = null;

const canUseTauri = () => "__TAURI_INTERNALS__" in window;

export async function getAppInfo(): Promise<AppInfo> {
  if (!canUseTauri()) {
    return {
      name: "Nikon Connector",
      version: import.meta.env.PACKAGE_VERSION ?? "0.1.3",
      changelog: browserChangelog,
      updateEndpoint:
        "https://github.com/Asplitline/nikon-connector/releases/latest/download/latest.json",
    };
  }

  return invoke<AppInfo>("get_app_info");
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!canUseTauri()) {
    throw new Error("Updates can only be checked in the desktop app.");
  }

  pendingUpdate = await check();

  if (!pendingUpdate) {
    return null;
  }

  return {
    body: pendingUpdate.body,
    currentVersion: pendingUpdate.currentVersion,
    date: pendingUpdate.date,
    version: pendingUpdate.version,
  };
}

export async function installPendingUpdate(
  onEvent?: (event: DownloadEvent) => void,
) {
  if (!pendingUpdate) {
    throw new Error("Check for an update before installing.");
  }

  await pendingUpdate.downloadAndInstall(onEvent);
  await relaunch();
}

export async function getLogInfo(): Promise<LogInfo> {
  if (!canUseTauri()) {
    return {
      exportPath: "Browser preview does not write desktop logs.",
      logPath: "Browser preview does not write desktop logs.",
      sizeBytes: 0,
    };
  }

  return invoke<LogInfo>("get_log_info");
}

export async function exportLogs(): Promise<string> {
  if (!canUseTauri()) {
    throw new Error("Logs can only be exported in the desktop app.");
  }

  return invoke<string>("export_logs");
}

export async function clearLogs(): Promise<LogInfo> {
  if (!canUseTauri()) {
    return {
      exportPath: "Browser preview does not write desktop logs.",
      logPath: "Browser preview does not write desktop logs.",
      sizeBytes: 0,
    };
  }

  return invoke<LogInfo>("clear_logs");
}

export async function revealPath(path: string): Promise<void> {
  if (!canUseTauri()) {
    throw new Error("Files can only be shown in the desktop app.");
  }

  await invoke("reveal_path", { path });
}

export function writeAppLog(
  level: LogLevel,
  target: string,
  message: string,
): void {
  if (!canUseTauri()) {
    return;
  }

  void invoke("write_client_log", { level, message, target }).catch(() => undefined);
}

const browserChangelog = `# 发布日志

## [未发布]

- 桌面更新功能会在打包后的 Tauri 应用中可用。
`;
