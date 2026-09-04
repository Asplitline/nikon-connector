import { defaultLocale, type Locale, t } from "../../i18n";
import { formatPerformanceOccupancy, type PerformanceMetrics } from "./metrics";

export function PerformancePanel({
  locale = defaultLocale,
  metrics,
}: {
  locale?: Locale;
  metrics: PerformanceMetrics;
}) {
  return (
    <section className="performance-panel mt-8 space-y-3">
      <p className="section-label">{t("performance.title", undefined, locale)}</p>
      <dl className="m-0 grid gap-[7px]">
        <div className="flex min-w-0 items-baseline justify-between gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-[9px]">
          <dt className="text-ui-xs font-ui-760 leading-[1.2] text-muted">{t("performance.fps", undefined, locale)}</dt>
          <dd className="m-0 text-right text-ui-5xl font-ui-800 leading-[1.2] tabular-nums whitespace-nowrap text-ink">{metrics.fps === null ? "--" : metrics.fps}</dd>
        </div>
        <div className="flex min-w-0 items-baseline justify-between gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-[9px]">
          <dt className="text-ui-xs font-ui-760 leading-[1.2] text-muted">{t("performance.occupancy", undefined, locale)}</dt>
          <dd className="m-0 text-right text-ui-5xl font-ui-800 leading-[1.2] tabular-nums whitespace-nowrap text-ink">{formatPerformanceOccupancy(metrics.memory)}</dd>
        </div>
      </dl>
    </section>
  );
}
