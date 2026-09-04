import { defaultLocale, type Locale, t } from "../../i18n";
import type { ShootingReview } from "./shootingReview";

export function ShootingReviewPanel({
  disabled = false,
  locale = defaultLocale,
  review,
}: {
  disabled?: boolean;
  locale?: Locale;
  review: ShootingReview;
}) {
  const formatMix = Object.entries(review.formats)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([format, count]) => `${format.toUpperCase()} ${count}`)
    .join(" · ");

  return (
    <section className={`mt-8 space-y-3 ${disabled ? "opacity-55" : ""}`}>
      <p className="section-label">{t("review.shootingTitle", undefined, locale)}</p>
      <div className="grid grid-cols-3 gap-[7px]">
        <div className="min-w-0 rounded-lg border border-line bg-surface p-2">
          <dt className="text-ui-2xs font-ui-760 leading-[1.1] text-muted">{t("review.metric.rated", undefined, locale)}</dt>
          <dd className="mt-[5px] mb-0 text-base font-ui-800 leading-none text-ink">{review.rated}</dd>
        </div>
        <div className="min-w-0 rounded-lg border border-line bg-surface p-2">
          <dt className="text-ui-2xs font-ui-760 leading-[1.1] text-muted">{t("review.metric.keepers", undefined, locale)}</dt>
          <dd className="mt-[5px] mb-0 text-base font-ui-800 leading-none text-ink">{review.keepers}</dd>
        </div>
        <div className="min-w-0 rounded-lg border border-line bg-surface p-2">
          <dt className="text-ui-2xs font-ui-760 leading-[1.1] text-muted">{t("review.metric.keepRate", undefined, locale)}</dt>
          <dd className="mt-[5px] mb-0 text-base font-ui-800 leading-none text-ink">{Math.round(review.keepRate * 100)}%</dd>
        </div>
      </div>
      <p className="text-ui-xl font-ui-700 leading-[1.45] wrap-anywhere text-muted">
        {formatMix || t("review.noFormats", undefined, locale)}
      </p>
      <p className="text-ui-xl font-ui-700 leading-[1.45] wrap-anywhere text-muted">
        {t(
          "review.summary",
          {
            total: review.total,
            unrated: review.unrated,
          },
          locale,
        )}
      </p>
    </section>
  );
}
