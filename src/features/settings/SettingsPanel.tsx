import { useMemo, useState, type ReactNode } from "react";
import { defaultLocale, locales, type Locale, t } from "../../i18n";
import type { AppInfo, LogInfo } from "../../lib/appApi";
import { formatBytes } from "../../lib/format";
import type { LogStatus, ThemeMode, UpdateStatus } from "../app/uiTypes";
import { AppearanceControls } from "./AppearanceControls";
import { updateMessageClass } from "../app/statusStyles";
import { buttonClass, iconButtonClass } from "../app/buttonStyles";
import { parseChangelog } from "./releaseNotes";
import { isOpenableSettingsValue, openSettingsLink } from "./settingsLinks";

type SettingsTab = "general" | "updates" | "diagnostics" | "releaseNotes";

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const tabs = settingsTabs(locale);

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
        className="shadow-[0_28px_90px_color-mix(in_oklch,var(--app-ink)_28%,transparent),0_2px_8px_color-mix(in_oklch,var(--app-ink)_12%,transparent)] relative z-10 flex h-[min(720px,calc(100vh-48px))] w-[860px] max-w-full flex-col overflow-hidden rounded-xl border border-line bg-panel max-sm:h-full max-sm:w-full max-sm:rounded-[10px]"
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

        <div className="grid min-h-0 flex-1 grid-cols-[184px_minmax(0,1fr)] max-sm:grid-cols-1">
          <nav
            aria-label={t("settings.settings", undefined, locale)}
            className="border-r border-line bg-[color-mix(in_oklch,var(--app-panel)_84%,var(--app-canvas))] p-3 max-sm:border-b max-sm:border-r-0"
            role="tablist"
          >
            <div className="grid gap-1 max-sm:grid-cols-4 max-sm:overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  aria-controls={`settings-panel-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  className={settingsTabClass}
                  id={`settings-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <div className="min-h-0 overflow-y-auto px-5 py-5">
            <SettingsTabPanel active={activeTab === "general"} tab="general">
              <div className="space-y-[30px]">
                <LanguageSection locale={locale} onLocaleChange={onLocaleChange} />

                <AppearanceControls
                  locale={locale}
                  onThemeChange={onThemeChange}
                  theme={theme}
                />
              </div>
            </SettingsTabPanel>

            <SettingsTabPanel active={activeTab === "updates"} tab="updates">
              <div className="space-y-[30px]">
                <VersionSection appInfo={appInfo} locale={locale} />

                <UpdateSection
                  autoUpdateEnabled={autoUpdateEnabled}
                  locale={locale}
                  onCheckForUpdate={onCheckForUpdate}
                  onInstallUpdate={onInstallUpdate}
                  onToggleAutoUpdate={onToggleAutoUpdate}
                  updateStatus={updateStatus}
                />
              </div>
            </SettingsTabPanel>

            <SettingsTabPanel active={activeTab === "diagnostics"} tab="diagnostics">
              <LogSection
                locale={locale}
                logInfo={logInfo}
                logStatus={logStatus}
                onExportLogs={onExportLogs}
              />
            </SettingsTabPanel>

            <SettingsTabPanel active={activeTab === "releaseNotes"} tab="releaseNotes">
              <ReleaseNotesSection changelog={appInfo?.changelog ?? null} locale={locale} />
            </SettingsTabPanel>
          </div>
        </div>
      </section>
    </div>
  );
}

function settingsTabs(locale: Locale): Array<{ id: SettingsTab; label: string }> {
  return [
    { id: "general", label: t("settings.tab.general", undefined, locale) },
    { id: "updates", label: t("settings.tab.updates", undefined, locale) },
    { id: "diagnostics", label: t("settings.tab.diagnostics", undefined, locale) },
    { id: "releaseNotes", label: t("settings.tab.releaseNotes", undefined, locale) },
  ];
}

const settingsTabClass =
  "flex h-9 min-w-0 items-center rounded-lg px-3 text-left text-ui-4xl font-ui-700 text-muted transition-[background-color,color] duration-[180ms] ease-[ease] hover:bg-hover hover:text-ink aria-selected:bg-surface aria-selected:text-ink aria-selected:shadow-[inset_0_0_0_1px_var(--app-line-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:justify-center";

function SettingsTabPanel({
  active,
  children,
  tab,
}: {
  active: boolean;
  children: ReactNode;
  tab: SettingsTab;
}) {
  return (
    <section
      aria-labelledby={`settings-tab-${tab}`}
      hidden={!active}
      id={`settings-panel-${tab}`}
      role="tabpanel"
    >
      {children}
    </section>
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
          <SettingsValue locale={locale}>{appInfo?.name ?? t("app.name", undefined, locale)}</SettingsValue>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.version", undefined, locale)}</dt>
          <SettingsValue locale={locale}>{appInfo?.version ?? loading}</SettingsValue>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.updateFeed", undefined, locale)}</dt>
          <SettingsValue locale={locale} openableValue={appInfo?.updateEndpoint}>
            {appInfo?.updateEndpoint ?? loading}
          </SettingsValue>
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
          <SettingsValue locale={locale} openableValue={logInfo?.logPath}>
            {logInfo?.logPath ?? loading}
          </SettingsValue>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.exportFile", undefined, locale)}</dt>
          <SettingsValue locale={locale} openableValue={logInfo?.exportPath}>
            {logInfo?.exportPath ?? loading}
          </SettingsValue>
        </div>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-b-line-soft pb-3">
          <dt className="text-muted">{t("settings.logSize", undefined, locale)}</dt>
          <SettingsValue locale={locale}>{logInfo ? formatBytes(logInfo.sizeBytes) : loading}</SettingsValue>
        </div>
      </dl>
    </section>
  );
}

function SettingsValue({
  children,
  locale,
  openableValue,
}: {
  children: ReactNode;
  locale: Locale;
  openableValue?: string | null;
}) {
  if (!isOpenableSettingsValue(openableValue)) {
    return <dd className="min-w-0 font-ui-600 wrap-anywhere">{children}</dd>;
  }

  return (
    <dd className="min-w-0">
      <button
        className="inline-flex max-w-full items-center gap-2 rounded-md text-left font-ui-600 text-ink underline decoration-line underline-offset-4 transition-colors hover:text-[color-mix(in_oklch,var(--app-ink)_82%,var(--app-focus))] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={() => void openSettingsLink(openableValue).catch(() => undefined)}
        title={openableValue}
        type="button"
      >
        <span className="min-w-0 truncate">{children}</span>
        <span className="shrink-0 text-ui-xs font-ui-700 text-muted">
          {t("settings.open", undefined, locale)}
        </span>
      </button>
    </dd>
  );
}

function ReleaseNotesSection({
  changelog,
  locale,
}: {
  changelog: string | null;
  locale: Locale;
}) {
  const sections = useMemo(
    () => parseChangelog(changelog ?? t("settings.loadingLog", undefined, locale)),
    [changelog, locale],
  );

  return (
    <section>
      <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-line bg-panel px-5 py-4">
        <p className="section-label">{t("settings.developmentLog", undefined, locale)}</p>
      </div>
      <div className="mt-5 space-y-5">
        {sections.map((section, index) => (
          <article
            className="rounded-lg border border-line bg-surface p-4"
            key={`${section.title}-${index}`}
          >
            {section.title ? (
              <h3 className="text-[15px] font-ui-700 leading-none text-ink">
                {section.title}
              </h3>
            ) : null}
            {section.body ? (
              <p className="mt-3 text-sm leading-6 text-muted whitespace-pre-wrap">
                {section.body}
              </p>
            ) : null}
            {section.items.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                {section.items.map((item, itemIndex) => (
                  <li className="grid grid-cols-[12px_minmax(0,1fr)] gap-2" key={`${item}-${itemIndex}`}>
                    <span className="mt-[0.65em] h-1.5 w-1.5 rounded-full bg-muted" />
                    <span className="min-w-0 wrap-anywhere">{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
