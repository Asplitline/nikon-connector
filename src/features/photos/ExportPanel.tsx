import { defaultLocale, type Locale, t } from "../../i18n";
import type { ExportStatus } from "../app/uiTypes";
import type { ExportMode } from "./exportPlan";
import { exportModeOptions, formatExportMode, formatExportStatus } from "./labels";
import { exportStatusClass } from "../app/statusStyles";
import { buttonClass } from "../app/buttonStyles";
import { fieldInputClass, fieldLabelClass } from "../app/formStyles";

export function ExportPanel({
  destination,
  disabled = false,
  exportCount,
  exportSizeMb,
  locale = defaultLocale,
  mode,
  onDestinationChange,
  onExport,
  onModeChange,
  status,
}: {
  destination: string;
  disabled?: boolean;
  exportCount: number;
  exportSizeMb: number;
  locale?: Locale;
  mode: ExportMode;
  onDestinationChange: (destination: string) => void;
  onExport: () => void;
  onModeChange: (mode: ExportMode) => void;
  status: ExportStatus;
}) {
  return (
    <section className="min-w-0 mt-8 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("export.title", undefined, locale)}</p>
        <span className={exportStatusClass(status)}>
          {formatExportStatus(status, locale)}
        </span>
      </div>

      <label className={fieldLabelClass}>
        <span>{t("export.mode", undefined, locale)}</span>
        <select
          className={fieldInputClass}
          disabled={disabled}
          onChange={(event) => onModeChange(event.target.value as ExportMode)}
          value={mode}
        >
          {exportModeOptions.map((option) => (
            <option key={option} value={option}>
              {formatExportMode(option, locale)}
            </option>
          ))}
        </select>
      </label>

      <label className={fieldLabelClass}>
        <span>{t("export.destination", undefined, locale)}</span>
        <input
          className={fieldInputClass}
          disabled={disabled}
          onChange={(event) => onDestinationChange(event.target.value)}
          placeholder={t("export.destinationPlaceholder", undefined, locale)}
          type="text"
          value={destination}
        />
      </label>

      <p className="text-ui-xl font-ui-700 leading-[1.4] text-muted">
        {t(
          "export.summary",
          {
            count: exportCount,
            size: `${exportSizeMb.toFixed(1)} MB`,
          },
          locale,
        )}
      </p>

      <button
        className={buttonClass("primary", { compact: true })}
        disabled={disabled || exportCount === 0 || !destination.trim()}
        onClick={onExport}
        type="button"
      >
        {t("export.action", undefined, locale)}
      </button>
    </section>
  );
}
