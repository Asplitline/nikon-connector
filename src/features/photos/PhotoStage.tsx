import { useCallback, useEffect, useRef, useState } from "react";
import { type Locale, t } from "../../i18n";
import { writeAppLog } from "../../lib/appApi";
import { imageSource } from "../../lib/format";
import type { CameraPhoto } from "./types";
import type { PickStatus, Rating } from "./types";
import { computeWindowRange, scrollOffsetForIndex } from "./windowing";
import {
  applyPanDrag,
  canStartPanDrag,
  createFitPanState,
  formatPhotoTransform,
  hasPhotoPan,
  type PhotoPanState,
  type PhotoZoomState,
  type ZoomAction,
} from "./zoom";
import { iconButtonClass, zoomTextButtonClass } from "../app/buttonStyles";
import { filmstripItemClass, reviewImageClass } from "./photoStyles";
import { resolvePreviewSwapState } from "./previewSwap";
import { StarRating } from "./StarRating";

// 照片舞台：缩放工具栏 + 主预览图。空态由调用方以 children 传入
export function PhotoStage({
  disabled = false,
  locale,
  onNext,
  onPrevious,
  onMark,
  onRate,
  onZoomAction,
  photo,
  zoom,
  zoomLabel,
}: {
  disabled?: boolean;
  locale: Locale;
  onNext: () => void;
  onPrevious: () => void;
  onMark: (status: PickStatus) => void;
  onRate: (rating: Rating) => void;
  onZoomAction: (action: ZoomAction) => void;
  photo: CameraPhoto;
  zoom: PhotoZoomState;
  zoomLabel: string;
}) {
  const hasAnyPreviewSource = Boolean(photo.previewUrl || photo.thumbnailUrl);

  return (
    <>
      <div className="absolute bottom-5 right-5 z-10 flex items-center gap-1 rounded-md border border-stage-line bg-stage-toolbar p-1 text-on-image opacity-0 shadow-[0_12px_32px_color-mix(in_oklch,var(--app-ink)_22%,transparent)] transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100 max-sm:right-3 max-sm:top-3 max-sm:bottom-auto max-sm:opacity-100">
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
          onClick={() => onZoomAction(zoom.mode === "fit" ? "actual" : "fit")}
          title={zoom.mode === "fit" ? t("zoom.actual", undefined, locale) : t("zoom.fitTitle", undefined, locale)}
          type="button"
        >
          ⛶
        </button>
      </div>
      <button
        aria-label={t("photo.previous", undefined, locale)}
        className="absolute left-0 top-1/2 z-10 grid h-[112px] w-14 -translate-y-1/2 place-items-center rounded-r-md bg-stage-toolbar text-4xl leading-none text-on-image opacity-0 transition-opacity duration-300 hover:opacity-85 group-hover:opacity-45 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:opacity-55"
        onClick={onPrevious}
        type="button"
      >
        ‹
      </button>
      <button
        aria-label={t("photo.next", undefined, locale)}
        className="absolute right-0 top-1/2 z-10 grid h-[112px] w-14 -translate-y-1/2 place-items-center rounded-l-md bg-stage-toolbar text-4xl leading-none text-on-image opacity-0 transition-opacity duration-300 hover:opacity-85 group-hover:opacity-45 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:opacity-55"
        onClick={onNext}
        type="button"
      >
        ›
      </button>
      {hasAnyPreviewSource ? (
        <PhotoPreviewImage
          key={`${photo.id}:${zoom.mode === "scaled" && zoom.scale > 1 ? "draggable" : "locked"}`}
          locale={locale}
          onZoomAction={onZoomAction}
          photo={photo}
          zoom={zoom}
        />
      ) : (
        <div className="text-center text-stage-muted">
          {t("photo.previewUnavailable", undefined, locale)}
        </div>
      )}
      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border border-stage-line bg-stage-toolbar px-2.5 py-1.5 text-on-image opacity-0 shadow-[0_14px_36px_color-mix(in_oklch,var(--app-ink)_22%,transparent)] transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100 max-sm:bottom-3 max-sm:opacity-100">
        <StarRating
          disabled={disabled}
          labels={{
            clear: t("rating.clear", undefined, locale),
            rating: (value) => t("rating.label", { value }, locale),
            star: (value) => t("rating.star", { value }, locale),
          }}
          onChange={onRate}
          value={photo.rating}
          variant="overlay"
        />
        <span className="h-5 w-px bg-stage-line" aria-hidden="true" />
        <button
          className={[
            "min-h-8 rounded-md px-2.5 text-ui-sm font-ui-760 transition hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            photo.pickStatus === "picked" ? "text-star" : "text-on-image/78",
          ].join(" ")}
          disabled={disabled}
          onClick={() => onMark(photo.pickStatus === "picked" ? "none" : "picked")}
          title={t("pick.toggleTitle", undefined, locale)}
          type="button"
        >
          ✓ {t("pick.picked", undefined, locale)}
        </button>
        <button
          aria-label={t("pick.reject", undefined, locale)}
          className={[
            "grid h-8 w-8 place-items-center rounded-md text-base font-ui-760 transition hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
            photo.pickStatus === "rejected" ? "text-danger" : "text-on-image/68",
          ].join(" ")}
          disabled={disabled}
          onClick={() => onMark(photo.pickStatus === "rejected" ? "none" : "rejected")}
          title={t("pick.rejectTitle", undefined, locale)}
          type="button"
        >
          ×
        </button>
      </div>
    </>
  );
}

function PhotoPreviewImage({
  locale,
  onZoomAction,
  photo,
  zoom,
}: {
  locale: Locale;
  onZoomAction: (action: ZoomAction) => void;
  photo: CameraPhoto;
  zoom: PhotoZoomState;
}) {
  const [pan, setPan] = useState<PhotoPanState>(createFitPanState);
  const [isPanDragging, setIsPanDragging] = useState(false);
  const [visibleImage, setVisibleImage] = useState({
    loadedPreviewUrl: photo.previewUrl || null,
    photoId: photo.id,
    url: photo.previewUrl || photo.thumbnailUrl,
  });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
    pointerId: number;
  } | null>(null);
  const canDragPhoto = zoom.mode === "scaled" && zoom.scale > 1;
  const isPhotoMoved = hasPhotoPan(pan);
  const swapState = resolvePreviewSwapState({
    loadedPreviewUrl:
      visibleImage.photoId === photo.id ? visibleImage.loadedPreviewUrl : photo.previewUrl || null,
    previewUrl: photo.previewUrl,
    thumbnailUrl: photo.thumbnailUrl,
    visibleUrl: visibleImage.photoId === photo.id ? visibleImage.url : photo.previewUrl || photo.thumbnailUrl,
  });
  const sourceUrl = swapState.visibleUrl;

  const getPinchDistance = useCallback(() => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) {
      return null;
    }

    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }, []);

  const resetPinch = useCallback(() => {
    pointersRef.current.clear();
    pinchStartRef.current = null;
    dragRef.current = null;
    setIsPanDragging(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointersRef.current.size === 2) {
        dragRef.current = null;
        setIsPanDragging(false);
        const distance = getPinchDistance();
        if (distance) {
          pinchStartRef.current = {
            distance,
            scale: zoom.mode === "fit" ? 1 : zoom.scale,
          };
        }
        return;
      }

      if (canStartPanDrag({ button: event.button, canDragPhoto })) {
        dragRef.current = {
          isDragging: true,
          lastX: event.clientX,
          lastY: event.clientY,
          pointerId: event.pointerId,
        };
        setIsPanDragging(true);
      }
    },
    [canDragPhoto, getPinchDistance, zoom.mode, zoom.scale],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }

      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const drag = dragRef.current;
      if (drag?.pointerId === event.pointerId && pointersRef.current.size === 1) {
        dragRef.current = {
          ...drag,
          isDragging: drag.isDragging,
          lastX: event.clientX,
          lastY: event.clientY,
        };
        if (drag.isDragging) {
          event.preventDefault();
          setPan((current) =>
            applyPanDrag(current, {
              x: event.clientX - drag.lastX,
              y: event.clientY - drag.lastY,
            }),
          );
        }
        return;
      }

      const pinchStart = pinchStartRef.current;
      const distance = getPinchDistance();
      if (!pinchStart || !distance || pinchStart.distance <= 0) {
        return;
      }

      event.preventDefault();
      onZoomAction({
        type: "scale",
        scale: (pinchStart.scale * distance) / pinchStart.distance,
      });
    },
    [getPinchDistance, onZoomAction],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      pointersRef.current.delete(event.pointerId);
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
        setIsPanDragging(false);
      }
      if (pointersRef.current.size < 2) {
        pinchStartRef.current = null;
      }
    },
    [],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLImageElement>) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      onZoomAction({
        type: "scale-factor",
        factor: event.deltaY < 0 ? 1.08 : 1 / 1.08,
      });
    },
    [onZoomAction],
  );

  return (
    <>
      {swapState.isLoadingUpgrade ? (
        <div
          aria-live="polite"
          className="absolute right-5 top-5 z-10 flex h-8 items-center gap-2 rounded-md border border-stage-line bg-stage-toolbar px-2.5 text-ui-xs font-ui-760 text-on-image shadow-[0_12px_30px_color-mix(in_oklch,var(--app-ink)_18%,transparent)] max-sm:right-3 max-sm:top-[56px]"
        >
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-full border-2 border-on-image/30 border-t-on-image motion-safe:animate-spin"
          />
          {t("photo.previewLoading", undefined, locale)}
        </div>
      ) : null}
      {swapState.preloadUrl ? (
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          decoding="async"
          onLoad={() => {
            setVisibleImage({
              loadedPreviewUrl: swapState.preloadUrl,
              photoId: photo.id,
              url: swapState.preloadUrl,
            });
          }}
          src={imageSource(swapState.preloadUrl)}
        />
      ) : null}
      <img
        alt={photo.fileName}
        className={reviewImageClass(zoom.mode === "fit")}
        draggable={false}
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
        onDoubleClick={() => onZoomAction(zoom.mode === "fit" ? "actual" : "fit")}
        onLostPointerCapture={handlePointerUp}
        onPointerCancel={resetPinch}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        src={imageSource(sourceUrl)}
        style={{
          cursor: canDragPhoto ? (isPanDragging ? "grabbing" : "grab") : undefined,
          transform: formatPhotoTransform(zoom, pan),
        }}
      />
      {isPhotoMoved ? (
        <button
          aria-label={t("photo.resetPan", undefined, locale)}
          className="shadow-[0_12px_32px_color-mix(in_oklch,var(--app-ink)_24%,transparent)] absolute bottom-5 right-5 z-10 rounded-lg border border-stage-line bg-stage-toolbar px-3 py-2 text-sm font-ui-700 text-on-image transition-[background-color,border-color,transform] duration-[180ms] ease-[ease] hover:bg-[color-mix(in_oklch,var(--app-ink)_72%,transparent)] active:translate-y-px max-sm:bottom-3 max-sm:right-3"
          onClick={() => setPan(createFitPanState())}
          title={t("photo.resetPan", undefined, locale)}
          type="button"
        >
          {t("photo.resetPan", undefined, locale)}
        </button>
      ) : null}
    </>
  );
}

// 胶片条项尺寸，与下面 className 里的 w-[98px] / gap-2 保持一致；
// 小屏用 max-sm:w-[92px]，实际宽度在挂载后按 DOM 实测校正
const filmstripItemWidth = 98;
const filmstripGap = 8;
const selectedFilmstripEdgePadding = 8;

export function Filmstrip({
  locale,
  onSelect,
  onVisibleWindowChange,
  photos,
  selectedPhotoId,
}: {
  locale: Locale;
  onSelect: (photoId: string) => void;
  onVisibleWindowChange?: (window: { endIndex: number; startIndex: number }) => void;
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

  useEffect(() => {
    onVisibleWindowChange?.({
      endIndex: range.endIndex,
      startIndex: range.startIndex,
    });
  }, [onVisibleWindowChange, range.endIndex, range.startIndex]);

  // 选中项被键盘换图移出视口时，把它滚回可见范围
  const selectedIndex = photos.findIndex((photo) => photo.id === selectedPhotoId);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || selectedIndex < 0) {
      return;
    }

    const nextOffset = scrollOffsetForIndex({
      edgePadding: selectedFilmstripEdgePadding,
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
    <div className="filmstrip-scroll min-w-0 overflow-x-auto py-0.5" onScroll={handleScroll} ref={scrollRef}>
      <div className="flex gap-2 px-1.5">
        {range.startSpacer > 0 ? (
          <div aria-hidden="true" style={{ flex: "0 0 auto", width: range.startSpacer }} />
        ) : null}
        {visiblePhotos.map((photo) => {
          const isSelected = photo.id === selectedPhotoId;
          const filmstripSourceUrl = photo.thumbnailUrl || photo.previewUrl;

          return (
            <button
              className={filmstripItemClass(isSelected)}
              aria-label={
                photo.rating
                  ? `${photo.fileName}, ${t("rating.star", { value: photo.rating }, locale)}`
                  : photo.fileName
              }
              aria-current={isSelected ? "true" : undefined}
              data-filmstrip-item=""
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              title={photo.fileName}
              type="button"
            >
              {filmstripSourceUrl ? (
                <img
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                  decoding="async"
                  loading="lazy"
                  onError={(event) => {
                    void writeAppLog(
                      "warn",
                      "frontend.photo_preview",
                      `thumbnail failed photo=${photo.id} source=${filmstripSourceUrl} rendered=${event.currentTarget.currentSrc}`,
                    );
                  }}
                  src={imageSource(filmstripSourceUrl)}
                />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-[linear-gradient(to_top,color-mix(in_oklch,var(--app-ink)_78%,transparent),transparent)] px-2 pb-2 pt-8 text-[11px] font-ui-760 text-on-image opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="min-w-0 truncate">{photo.fileName}</span>
                <span className="shrink-0">
                  {photo.pickStatus === "picked" ? "✓" : photo.pickStatus === "rejected" ? "×" : ""}
                  {photo.rating ? ` ${photo.rating}★` : ""}
                </span>
              </span>
              {isSelected ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-10 rounded-md border-2 border-focus"
                  data-selected-indicator="true"
                />
              ) : null}
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
