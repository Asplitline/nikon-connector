import { type Locale, t } from "../../i18n";
import type { CameraPhoto } from "./types";

export function PhotoDetails({
  locale,
  photo,
}: {
  locale: Locale;
  photo: CameraPhoto;
}) {
  const capturedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(photo.capturedAt));
  const shootingDetails = [
    { label: t("detail.aperture", undefined, locale), value: photo.aperture },
    { label: t("detail.focalLength", undefined, locale), value: photo.focalLength },
    { label: t("detail.iso", undefined, locale), value: photo.iso?.toString() },
    { label: t("detail.shutterSpeed", undefined, locale), value: photo.shutterSpeed },
    {
      label: t("detail.exposureCompensation", undefined, locale),
      value: photo.exposureCompensation,
    },
  ].filter((detail) => detail.value);

  return (
    <dl className="details-list mt-5 space-y-4 text-sm max-nav:mt-3.5 max-nav:grid max-nav:grid-cols-[repeat(5,minmax(120px,1fr))] max-nav:gap-3.5 max-nav:space-y-0 max-nav:overflow-x-auto max-sm:grid-cols-2 max-sm:overflow-x-visible">
      <div className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0">
        <dt className="text-muted">{t("detail.captured", undefined, locale)}</dt>
        <dd className="mt-1 font-medium leading-6 wrap-anywhere">{capturedAt}</dd>
      </div>
      <div className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0">
        <dt className="text-muted">{t("detail.format", undefined, locale)}</dt>
        <dd className="mt-1 font-medium uppercase wrap-anywhere">{photo.fileType}</dd>
      </div>
      <div className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0">
        <dt className="text-muted">{t("detail.resolution", undefined, locale)}</dt>
        <dd className="mt-1 font-medium wrap-anywhere">
          {photo.width} x {photo.height}
        </dd>
      </div>
      <div className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0">
        <dt className="text-muted">{t("detail.size", undefined, locale)}</dt>
        <dd className="mt-1 font-medium wrap-anywhere">{photo.sizeMb.toFixed(1)} MB</dd>
      </div>
      <div className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0">
        <dt className="text-muted">{t("detail.writeBack", undefined, locale)}</dt>
        <dd className="mt-1 font-medium wrap-anywhere">{t("detail.writeBackAdapter", undefined, locale)}</dd>
      </div>
      {shootingDetails.map((detail) => (
        <div
          className="min-w-0 border-b border-b-line-soft pb-3.5 last:border-b-0 last:pb-0 max-nav:border-b-0 max-nav:pb-0"
          key={detail.label}
        >
          <dt className="text-muted">{detail.label}</dt>
          <dd className="mt-1 font-medium wrap-anywhere">{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
}
