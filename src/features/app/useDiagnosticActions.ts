import { useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type Locale, t } from "../../i18n";
import { writeAppLog } from "../../lib/appApi";
import { openImageCapture } from "../../lib/cameraApi";
import type { DiagnosticActionKind } from "../photos/connectionDiagnostics";

const cameraPrivacyUrl =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera";

export interface DiagnosticActions {
  openImageCaptureApp: () => Promise<void>;
  runAction: (kind: DiagnosticActionKind) => Promise<void>;
}

// 连接诊断里的可执行动作：打开图像捕捉、跳转 macOS 相机隐私设置、重新扫描
export function useDiagnosticActions({
  locale,
  onRescan,
  onStatusMessage,
}: {
  locale: Locale;
  onRescan: () => Promise<void>;
  onStatusMessage: (message: string) => void;
}): DiagnosticActions {
  const tr = useCallback(
    (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) =>
      t(key, values, locale),
    [locale],
  );

  const openImageCaptureApp = useCallback(async () => {
    try {
      await openImageCapture();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.couldNotOpenImageCapture");
      onStatusMessage(message);
      writeAppLog("error", "frontend.image_capture", message);
    }
  }, [onStatusMessage, tr]);

  const runAction = useCallback(
    async (kind: DiagnosticActionKind) => {
      if (kind === "open_camera_privacy" || kind === "open_macos_privacy") {
        try {
          await openUrl(cameraPrivacyUrl);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : tr("status.couldNotOpenPrivacy");
          onStatusMessage(message);
          writeAppLog("error", "frontend.privacy", message);
        }
        return;
      }

      if (kind === "open_image_capture") {
        await openImageCaptureApp();
        return;
      }

      if (kind === "rescan") {
        await onRescan();
      }
    },
    [onRescan, onStatusMessage, openImageCaptureApp, tr],
  );

  return { openImageCaptureApp, runAction };
}
