import { ConnectionDiagnosticDialog } from "../photos/ConnectionDiagnosticDialog";
import type {
  ConnectionDiagnostics,
  DiagnosticActionKind,
} from "../photos/connectionDiagnostics";
import { SettingsPanel } from "../settings/SettingsPanel";
import type { ThemeMode } from "./uiTypes";
import type { useAppUpdates } from "./useAppUpdates";
import type { Locale } from "../../i18n";

// 覆盖层:设置面板与连接检查弹窗,均由容器层持有开关状态
export function AppDialogs({
  connectionCheckOpen,
  diagnostics,
  locale,
  onCloseConnectionCheck,
  onCloseSettings,
  onDiagnosticAction,
  onLocaleChange,
  onOpenImageCapture,
  onPrimaryDiagnosticAction,
  onThemeChange,
  settingsOpen,
  theme,
  updates,
}: {
  connectionCheckOpen: boolean;
  diagnostics: ConnectionDiagnostics;
  locale: Locale;
  onCloseConnectionCheck: () => void;
  onCloseSettings: () => void;
  onDiagnosticAction: (kind: DiagnosticActionKind) => void;
  onLocaleChange: (locale: Locale) => void;
  onOpenImageCapture: () => void;
  onPrimaryDiagnosticAction: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  settingsOpen: boolean;
  theme: ThemeMode;
  updates: ReturnType<typeof useAppUpdates>;
}) {
  return (
    <>
      {settingsOpen ? (
        <SettingsPanel
          appInfo={updates.appInfo}
          autoUpdateEnabled={updates.autoUpdateEnabled}
          locale={locale}
          logInfo={updates.logInfo}
          logStatus={updates.logStatus}
          onCheckForUpdate={() => void updates.checkNow()}
          onClose={onCloseSettings}
          onExportLogs={() => void updates.exportLogBundle()}
          onInstallUpdate={() => void updates.installUpdate()}
          onLocaleChange={onLocaleChange}
          onThemeChange={onThemeChange}
          onToggleAutoUpdate={updates.setAutoUpdateEnabled}
          theme={theme}
          updateStatus={updates.updateStatus}
        />
      ) : null}

      {connectionCheckOpen ? (
        <ConnectionDiagnosticDialog
          diagnostics={diagnostics}
          locale={locale}
          onAction={onDiagnosticAction}
          onClose={onCloseConnectionCheck}
          onOpenImageCapture={onOpenImageCapture}
          onPrimaryAction={onPrimaryDiagnosticAction}
        />
      ) : null}
    </>
  );
}
