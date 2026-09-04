import { defaultLocale, type Locale, t } from "../../i18n";
import type { PhotoCatalogFilter, PhotoCatalogSort } from "./catalog";
import { fieldInputClass, fieldLabelClass } from "../app/formStyles";
import {
  catalogFilterOptions,
  catalogSortOptions,
  formatCatalogFilter,
  formatCatalogSort,
} from "./labels";

export function ReviewControls({
  disabled = false,
  filter,
  locale = defaultLocale,
  onFilterChange,
  onSortChange,
  sort,
  visibleCount,
}: {
  disabled?: boolean;
  filter: PhotoCatalogFilter;
  locale?: Locale;
  onFilterChange: (filter: PhotoCatalogFilter) => void;
  onSortChange: (sort: PhotoCatalogSort) => void;
  sort: PhotoCatalogSort;
  visibleCount: number;
}) {
  return (
    <section className="min-w-0 mt-8 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("review.culling", undefined, locale)}</p>
        <span className="shrink-0 text-ui-xs font-ui-760 leading-none whitespace-nowrap text-muted">
          {t("review.visibleCount", { count: visibleCount }, locale)}
        </span>
      </div>

      <label className={fieldLabelClass}>
        <span>{t("review.filter", undefined, locale)}</span>
        <select
          className={fieldInputClass}
          disabled={disabled}
          onChange={(event) => onFilterChange(event.target.value as PhotoCatalogFilter)}
          value={filter}
        >
          {catalogFilterOptions.map((option) => (
            <option key={option} value={option}>
              {formatCatalogFilter(option, locale)}
            </option>
          ))}
        </select>
      </label>

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
    </section>
  );
}
