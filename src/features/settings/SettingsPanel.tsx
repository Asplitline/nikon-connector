import { defaultLocale, locales, type Locale, t } from "../../i18n";
import type { AppInfo, LogInfo } from "../../lib/appApi";
import { formatBytes } from "../../lib/format";
import type { LogStatus, ThemeMode, UpdateStatus } from "../app/uiTypes";
import { AppearanceControls } from "./AppearanceControls";
import { updateMessageClass } from "../app/statusStyles";
import { buttonClass, iconButtonClass } from "../app/buttonStyles";

export function SettingsPanel({
  appInfo,
  autoUpdateEnabled,
  logInfo,
  logStatus,
  locale = defaultLocale,
  onCheckForUpdate,
  onClose,
  onExportLogs,
  onInstallUpdate,
  onLocaleChange,
  onThemeChange,
  onToggleAutoUpdate,
  theme,
  updateStatus,
}: {
  appInfo: AppInfo | null;
  autoUpdateEnabled: boolean;
  logInfo: LogInfo | null;
  logStatus: LogStatus;
  locale?: Locale;
  onCheckForUpdate: () => void;
  onClose: () => void;
  onExportLogs: () => void;
  onInstallUpdate: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  theme: ThemeMode;
  updateStatus: UpdateStatus;
}) {
  return (
    <div className="bg-[color-mix(in_oklch,var(--app-ink)_34%,transparent)] fixed inset-0 z-20 grid place-items-center px-5 py-6 max-sm:items-stretch max-sm:p-3.5">
      <button
        aria-label={t("settings.close", undefined, locale)}
        className="cursor-default absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={t("settings.settings", undefined, locale)}
        aria-modal="true"
        className="shadow-[0_28px_90px_color-mix(in_oklch,var(--app-ink)_28%,transparent),0_2px_8px_color-mix(in_oklch,var(--app-ink)_12%,transparent)] relative z-10 flex max-h-full w-[760px] max-w-full flex-col overflow-hidden rounded-xl border border-line bg-panel max-sm:w-full max-sm:rounded-[10px]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="section-label">{t("settings.settings", undefined, locale)}</p>
            <h2 className="mt-2 text-xl font-semibold">{t("app.name", undefined, locale)}</h2>
          </div>
          <button
            aria-label={t("settings.close", undefined, locale)}
            className={iconButtonClass}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-[30px] overflow-y-auto px-5 py-5">
          <LanguageSection locale={locale} onLocaleChange={onLocaleChange} />

          <AppearanceControls
            locale={locale}
            onThemeChange={onThemeChange}
            theme={theme}
          />

          <VersionSection appInfo={appInfo} locale={locale} />

          <UpdateSection
            autoUpdateEnabled={autoUpdateEnabled}
            locale={locale}
            onCheckForUpdate={onCheckForUpdate}
            onInstallUpdate={onInstallUpdate}
            onToggleAutoUpdate={onToggleAutoUpdate}
            updateStatus={updateStatus}
          />

          <LogSection
            locale={locale}
            logInfo={logInfo}
            logStatus={logStatus}
            onExportLogs={onExportLogs}
          />

          <section>
            <p className="section-label">{t("settings.developmentLog", undefined, locale)}</p>
            <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-surface p-3.5 font-mono text-ui-xl leading-[1.65] whitespace-pre-wrap text-ink mt-4">
              {appInfo?.changelog ?? t("settings.loadingLog", undefined, locale)}
            </pre>
          </section>
        </div>
      </section>
    </div>
  );
}

function LanguageSection({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  return (
    <section>
      <p className="section-label">{t("app.language", undefined, locale)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {locales.map((nextLocale) => (
          <button
            className={buttonClass("secondary", {
              compact: true,
              extra: nextLocale === locale ? "active" : "",
            })}
            key={nextLocale}
            onClick={() => onLocaleChange(nextLocale)}
            type="button"
          >
            {t(
              nextLocale === "zh-CN" ? "app.locale.zh" : "app.locale.en",
              undefined,
              locale,
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function VersionSection({
  appInfo,
  locale,
}: {
  appInfo: AppInfo | null;
  locale: Locale;
}) {
  const loading = t("settings.loading", undefined, locale);

  return (
    <section>
      <p className="section-label">{t("settings.version", undefined, locale)}</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.name", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{appInfo?.name ?? t("app.name", undefined, locale)}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.version", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{appInfo?.version ?? loading}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.updateFeed", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{appInfo?.updateEndpoint ?? loading}</dd>
        </div>
      </dl>
    </section>
  );
}

function UpdateSection({
  autoUpdateEnabled,
  locale,
  onCheckForUpdate,
  onInstallUpdate,
  onToggleAutoUpdate,
  updateStatus,
}: {
  autoUpdateEnabled: boolean;
  locale: Locale;
  onCheckForUpdate: () => void;
  onInstallUpdate: () => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  updateStatus: UpdateStatus;
}) {
  const canInstall = updateStatus.state === "available";

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <p className="section-label">{t("settings.updates", undefined, locale)}</p>
        <label className="inline-flex min-h-9 items-center gap-2 text-ui-2xl font-ui-700 text-muted">
          <input
            className="accent-ink"
            checked={autoUpdateEnabled}
            onChange={(event) => onToggleAutoUpdate(event.currentTarget.checked)}
            type="checkbox"
          />
          <span>{t("settings.autoCheck", undefined, locale)}</span>
        </label>
      </div>
      <p className={updateMessageClass(updateStatus.state)}>{updateStatus.message}</p>
      {updateStatus.state === "available" ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          {t(
            "settings.currentAvailable",
            {
              current: updateStatus.update.currentVersion,
              available: updateStatus.update.version,
            },
            locale,
          )}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          className={buttonClass("secondary")}
          disabled={updateStatus.state === "checking" || updateStatus.state === "installing"}
          onClick={onCheckForUpdate}
          type="button"
        >
          {t("settings.checkNow", undefined, locale)}
        </button>
        <button
          className={buttonClass("primary")}
          disabled={!canInstall}
          onClick={onInstallUpdate}
          type="button"
        >
          {t("settings.install", undefined, locale)}
        </button>
      </div>
    </section>
  );
}

function LogSection({
  locale,
  logInfo,
  logStatus,
  onExportLogs,
}: {
  locale: Locale;
  logInfo: LogInfo | null;
  logStatus: LogStatus;
  onExportLogs: () => void;
}) {
  const loading = t("settings.loading", undefined, locale);

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <p className="section-label">{t("settings.diagnosticLogs", undefined, locale)}</p>
        <button
          className={buttonClass("secondary", { compact: true })}
          disabled={logStatus === "exporting"}
          onClick={onExportLogs}
          type="button"
        >
          {logStatus === "exporting"
            ? t("settings.exportingLogs", undefined, locale)
            : t("settings.exportLogs", undefined, locale)}
        </button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.logFile", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{logInfo?.logPath ?? loading}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.exportFile", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{logInfo?.exportPath ?? loading}</dd>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.logSize", undefined, locale)}</dt>
          <dd className="min-w-0 font-ui-600 wrap-anywhere">{logInfo ? formatBytes(logInfo.sizeBytes) : loading}</dd>
        </div>
      </dl>
    </section>
  );
}
