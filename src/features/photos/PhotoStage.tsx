import { useCallback, useEffect, useRef, useState } from "react";
import { type Locale, t } from "../../i18n";
import { writeAppLog } from "../../lib/appApi";
import { imageSource } from "../../lib/format";
import type { CameraPhoto } from "./types";
import { computeWindowRange, scrollOffsetForIndex } from "./windowing";
import type { PhotoZoomState, ZoomAction } from "./zoom";
import { iconButtonClass, zoomTextButtonClass } from "../app/buttonStyles";

// 照片舞台：缩放工具栏 + 主预览图。空态由调用方以 children 传入
export function PhotoStage({
  locale,
  onZoomAction,
  photo,
  zoom,
  zoomLabel,
}: {
  locale: Locale;
  onZoomAction: (action: ZoomAction) => void;
  photo: CameraPhoto;
  zoom: PhotoZoomState;
  zoomLabel: string;
}) {
  const sourceUrl = photo.previewUrl || photo.thumbnailUrl;

  return (
    <>
      <div className="shadow-[0_12px_32px_color-mix(in_oklch,var(--app-ink)_28%,transparent)] absolute left-5 top-5 z-10 flex items-center gap-1.5 rounded-lg border border-stage-line bg-stage-toolbar p-1 text-on-image max-sm:left-3 max-sm:top-3 max-sm:max-w-[calc(100%-24px)] max-sm:overflow-x-auto">
        <button
          aria-label={t("zoom.out", undefined, locale)}
          className={iconButtonClass}
          onClick={() => onZoomAction("out")}
          title={t("zoom.outTitle", undefined, locale)}
          type="button"
        >
          −
        </button>
        <span className="min-w-11 text-center text-ui-md font-ui-700 text-on-image">{zoomLabel}</span>
        <button
          aria-label={t("zoom.in", undefined, locale)}
          className={iconButtonClass}
          onClick={() => onZoomAction("in")}
          title={t("zoom.inTitle", undefined, locale)}
          type="button"
        >
          +
        </button>
        <button
          className={zoomTextButtonClass}
          onClick={() => onZoomAction("fit")}
          title={t("zoom.fitTitle", undefined, locale)}
          type="button"
        >
          {t("zoom.fit", undefined, locale)}
        </button>
        <button
          className={zoomTextButtonClass}
          onClick={() => onZoomAction("actual")}
          title={t("zoom.actual", undefined, locale)}
          type="button"
        >
          {t("zoom.actual", undefined, locale)}
        </button>
      </div>
      {sourceUrl ? (
        <img
          alt={photo.fileName}
          className={[
            "review-image rounded-md object-contain max-sm:max-h-[40vh]",
            zoom.mode === "fit" ? "max-h-full max-w-full" : "scaled",
          ].join(" ")}
          onError={(event) => {
            void writeAppLog(
              "warn",
              "frontend.photo_preview",
              `main image failed photo=${photo.id} source=${sourceUrl} rendered=${event.currentTarget.currentSrc}`,
            );
          }}
          onLoad={(event) => {
            void writeAppLog(
              "info",
              "frontend.photo_preview",
              `main image loaded photo=${photo.id} source=${sourceUrl} rendered=${event.currentTarget.currentSrc} natural=${event.currentTarget.naturalWidth}x${event.currentTarget.naturalHeight}`,
            );
          }}
          src={imageSource(sourceUrl)}
          style={zoom.mode === "scaled" ? { transform: `scale(${zoom.scale})` } : undefined}
        />
      ) : (
        <div className="text-center text-stage-muted">
          {t("photo.previewUnavailable", undefined, locale)}
        </div>
      )}
    </>
  );
}

// 胶片条项尺寸，与下面 className 里的 w-[148px] / gap-3 保持一致；
// 小屏用 max-sm:w-[136px]，实际宽度在挂载后按 DOM 实测校正
const filmstripItemWidth = 148;
const filmstripGap = 12;

export function Filmstrip({
  locale,
  onSelect,
  photos,
  selectedPhotoId,
}: {
  locale: Locale;
  onSelect: (photoId: string) => void;
  photos: CameraPhoto[];
  selectedPhotoId: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState({
    itemWidth: filmstripItemWidth,
    scrollLeft: 0,
    viewportWidth: 0,
  });

  // 视口宽度与项宽都按实测取，避免响应式断点下窗口算错
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    function measure() {
      const container = scrollRef.current;
      if (!container) {
        return;
      }
      const firstItem = container.querySelector<HTMLElement>("[data-filmstrip-item]");
      setMetrics((current) => ({
        itemWidth: firstItem?.offsetWidth || current.itemWidth,
        scrollLeft: container.scrollLeft,
        viewportWidth: container.clientWidth,
      }));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { clientWidth, scrollLeft } = event.currentTarget;
    setMetrics((current) =>
      current.scrollLeft === scrollLeft && current.viewportWidth === clientWidth
        ? current
        : { ...current, scrollLeft, viewportWidth: clientWidth },
    );
  }, []);

  const range = computeWindowRange({
    gap: filmstripGap,
    itemWidth: metrics.itemWidth,
    scrollLeft: metrics.scrollLeft,
    total: photos.length,
    viewportWidth: metrics.viewportWidth,
  });

  // 选中项被键盘换图移出视口时，把它滚回可见范围
  const selectedIndex = photos.findIndex((photo) => photo.id === selectedPhotoId);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || selectedIndex < 0) {
      return;
    }

    const nextOffset = scrollOffsetForIndex({
      gap: filmstripGap,
      index: selectedIndex,
      itemWidth: metrics.itemWidth,
      scrollLeft: container.scrollLeft,
      viewportWidth: container.clientWidth,
    });

    if (nextOffset !== container.scrollLeft) {
      container.scrollLeft = nextOffset;
    }
  }, [metrics.itemWidth, selectedIndex]);

  const visiblePhotos = photos.slice(range.startIndex, range.endIndex);

  return (
    <div className="filmstrip-scroll min-w-0 overflow-x-auto" onScroll={handleScroll} ref={scrollRef}>
      <div className="flex gap-3">
        {range.startSpacer > 0 ? (
          <div aria-hidden="true" style={{ flex: "0 0 auto", width: range.startSpacer }} />
        ) : null}
        {visiblePhotos.map((photo) => {
          const isSelected = photo.id === selectedPhotoId;

          return (
            <button
              className={[
                "group relative h-[116px] w-[148px] shrink-0 overflow-hidden rounded-lg border bg-surface text-left max-sm:h-[108px] max-sm:w-[136px]",
                "shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)]",
                "transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-[180ms] ease-[ease] hover:-translate-y-px active:translate-y-px",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                isSelected
                  ? "border-ink shadow-[0_0_0_2px_var(--app-surface),0_0_0_4px_var(--app-ink)]"
                  : "border-line hover:border-muted",
              ].join(" ")}
              aria-current={isSelected ? "true" : undefined}
              data-filmstrip-item=""
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              title={photo.fileName}
              type="button"
            >
              {photo.thumbnailUrl ? (
                <img
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                  decoding="async"
                  loading="lazy"
                  onError={(event) => {
                    void writeAppLog(
                      "warn",
                      "frontend.photo_preview",
                      `thumbnail failed photo=${photo.id} source=${photo.thumbnailUrl} rendered=${event.currentTarget.currentSrc}`,
                    );
                  }}
                  src={imageSource(photo.thumbnailUrl)}
                />
              ) : null}
              <span className="bg-[linear-gradient(to_top,color-mix(in_oklch,var(--app-ink)_78%,transparent),color-mix(in_oklch,var(--app-ink)_46%,transparent)_52%,transparent)] absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-2.5 pt-9 text-xs font-medium text-on-image">
                <span className="min-w-0 truncate">{photo.fileName}</span>
                <span className="shrink-0">
                  {photo.rating ? `${photo.rating}★` : t("app.unrated", undefined, locale)}
                </span>
              </span>
            </button>
          );
        })}
        {range.endSpacer > 0 ? (
          <div aria-hidden="true" style={{ flex: "0 0 auto", width: range.endSpacer }} />
        ) : null}
      </div>
    </div>
  );
}
