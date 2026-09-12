import {
  Aperture,
  CalendarClock,
  CircleGauge,
  FileType,
  Gauge,
  HardDrive,
  Ruler,
  Scan,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { type Locale, t } from "../../i18n";
import type { CameraPhoto } from "./types";

export function PhotoQuickInfo({
  locale,
  onToggle,
  photo,
}: {
  locale: Locale;
  onToggle: () => void;
  photo: CameraPhoto;
}) {
  const capturedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(photo.capturedAt));
  const details = [
    { Icon: CalendarClock, label: t("detail.captured", undefined, locale), value: capturedAt },
    { Icon: FileType, label: t("detail.format", undefined, locale), value: photo.fileType.toUpperCase() },
    {
      Icon: Scan,
      label: t("detail.resolution", undefined, locale),
      value: `${photo.width} x ${photo.height}`,
    },
    { Icon: HardDrive, label: t("detail.size", undefined, locale), value: `${photo.sizeMb.toFixed(1)} MB` },
    { Icon: Aperture, label: t("detail.aperture", undefined, locale), value: photo.aperture },
    { Icon: Ruler, label: t("detail.focalLength", undefined, locale), value: photo.focalLength },
    { Icon: Gauge, label: t("detail.iso", undefined, locale), value: photo.iso?.toString() },
    { Icon: Timer, label: t("detail.shutterSpeed", undefined, locale), value: photo.shutterSpeed },
    {
      Icon: CircleGauge,
      label: t("detail.exposureCompensation", undefined, locale),
      value: photo.exposureCompensation,
    },
  ].filter((detail): detail is { Icon: LucideIcon; label: string; value: string } =>
    Boolean(detail.value),
  );

  return (
    <aside className="absolute right-5 top-5 z-10 w-[172px] max-w-[calc(100vw-40px)] rounded-md border border-stage-line bg-stage-toolbar px-3 py-3 text-on-image shadow-[0_14px_42px_color-mix(in_oklch,var(--app-ink)_22%,transparent)] backdrop-blur-sm max-sm:right-3 max-sm:top-14 max-sm:w-[156px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <p className="truncate text-[11px] font-ui-760 leading-none text-on-image/72">
            {t("detail.quickTitle", undefined, locale)}
          </p>
        </div>
        <button
          aria-label={t("detail.hideQuickInfo", undefined, locale)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-on-image/70 transition hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] hover:text-on-image focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          onClick={onToggle}
          title={t("detail.hideQuickInfo", undefined, locale)}
          type="button"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.9} />
        </button>
      </div>
      <dl className="space-y-2.5">
        {details.map((detail) => (
          <div className="min-w-0" key={detail.label}>
            <dt className="flex min-w-0 items-center gap-1.5 text-[10px] font-ui-650 leading-none text-on-image/48">
              <detail.Icon
                aria-hidden="true"
                className="h-3 w-3 shrink-0 text-on-image/42"
                strokeWidth={1.8}
              />
              {detail.label}
            </dt>
            <dd className="mt-1 text-[12px] font-ui-700 leading-snug text-on-image wrap-anywhere">
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
