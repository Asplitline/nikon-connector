import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { defaultLocale, type Locale, t } from "../../i18n";
import type { PhotoCatalogSort } from "./catalog";
import { fieldInputClass, fieldLabelClass } from "../app/formStyles";
import {
  catalogSortOptions,
  formatCatalogSort,
} from "./labels";

export function ReviewControls({
  disabled = false,
  locale = defaultLocale,
  onSortChange,
  sort,
  variant = "panel",
  visibleCount,
}: {
  disabled?: boolean;
  locale?: Locale;
  onSortChange: (sort: PhotoCatalogSort) => void;
  sort: PhotoCatalogSort;
  variant?: "panel" | "header";
  visibleCount: number;
}) {
  const isHeader = variant === "header";
  const rootClass = isHeader ? "min-w-0" : "min-w-0 mt-8 space-y-3";
  const controlsClass = isHeader
    ? "flex min-w-0 items-center gap-2"
    : "space-y-3";
  const countClass = isHeader
    ? "shrink-0 pb-2 text-ui-xs font-ui-760 leading-none whitespace-nowrap text-muted"
    : "shrink-0 text-ui-xs font-ui-760 leading-none whitespace-nowrap text-muted";

  if (isHeader) {
    return (
      <section className={rootClass}>
        <div className="sr-only">
          <p className="section-label">{t("review.culling", undefined, locale)}</p>
        </div>

        <div className={controlsClass}>
          <ToolbarSelect
            ariaLabel={t("review.sort", undefined, locale)}
            disabled={disabled}
            onChange={(value) => onSortChange(value as PhotoCatalogSort)}
            value={sort}
            widthClass="w-[126px]"
          >
            {catalogSortOptions.map((option) => (
              <option key={option} value={option}>
                {formatCatalogSort(option, locale)}
              </option>
            ))}
          </ToolbarSelect>
        </div>
      </section>
    );
  }

  return (
    <section className={rootClass}>
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("review.culling", undefined, locale)}</p>
        <span className={countClass}>
          {t("review.visibleCount", { count: visibleCount }, locale)}
        </span>
      </div>

      <div className={controlsClass}>
        <label className={fieldLabelClass}>
          <span>{t("review.sort", undefined, locale)}</span>
          <select
            className={fieldInputClass}
            disabled={disabled}
            onChange={(event) => onSortChange(event.target.value as PhotoCatalogSort)}
            value={sort}
          >
            {catalogSortOptions.map((option) => (
              <option key={option} value={option}>
                {formatCatalogSort(option, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function ToolbarSelect({
  ariaLabel,
  children,
  disabled,
  onChange,
  value,
  widthClass,
}: {
  ariaLabel: string;
  children: ReactNode;
  disabled: boolean;
  onChange: (value: string) => void;
  value: string;
  widthClass: string;
}) {
  return (
    <label className={`relative block h-8 shrink-0 ${widthClass}`}>
      <span className="sr-only">{ariaLabel}</span>
      <select
        aria-label={ariaLabel}
        className="h-8 w-full appearance-none rounded-lg border border-line bg-[color-mix(in_oklch,var(--app-surface)_84%,var(--app-panel))] py-0 pl-2.5 pr-7 text-ui-sm font-ui-680 leading-8 text-ink outline-none transition-[background-color,border-color,color,box-shadow] duration-[180ms] ease-[ease] hover:bg-hover disabled:cursor-not-allowed disabled:opacity-55 focus-visible:shadow-[0_0_0_2px_var(--app-focus)]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted"
        strokeWidth={1.8}
      />
    </label>
  );
}
