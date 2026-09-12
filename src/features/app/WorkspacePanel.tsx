import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  X,
} from "lucide-react";
import {
  ConnectionDiagnosticPanel,
  ConnectionSetup,
  EmptyPhotoDetails,
} from "../photos/ConnectionPanels";
import type {
  ConnectionDiagnostics,
  DiagnosticActionKind,
} from "../photos/connectionDiagnostics";
import { ExportPanel } from "../photos/ExportPanel";
import {
  getPhotoReviewModeShortcut,
  shouldIgnorePhotoReviewShortcut,
} from "../photos/keyboard";
import { formatConnection } from "../photos/labels";
import { PhotoDetails } from "../photos/PhotoDetails";
import { Filmstrip, PhotoStage } from "../photos/PhotoStage";
import { ReviewControls } from "../photos/ReviewControls";
import { ShootingReviewPanel } from "../photos/ShootingReviewPanel";
import type { ShootingReview } from "../photos/shootingReview";
import type {
  CameraConnectionState,
  CameraDevice,
  CameraPhoto,
  PickStatus,
  PhotoCatalogState,
  Rating,
} from "../photos/types";
import { formatZoomLabel } from "../photos/zoom";
import type { PhotoZoomState, ZoomAction } from "../photos/zoom";
import type { Locale, t as translate } from "../../i18n";
import { photoStageClass } from "../photos/photoStyles";
import { StatusDot } from "./StatusDot";
import type { CatalogControls, ExportControls, LibraryStats } from "./uiTypes";

type Translate = (
  key: Parameters<typeof translate>[0],
  values?: Parameters<typeof translate>[1],
) => string;

type ReviewMode = "review" | "view";

// 右侧工作区：标题栏 + 照片舞台 + 详情面板 + 底部胶片条
// 选中照片及其在可见列表中的位置,一起决定标题栏与舞台的渲染
export interface WorkspaceSelection {
  catalogView: PhotoCatalogState;
  index: number;
  photo: CameraPhoto | undefined;
}

export function WorkspacePanel({
  activeCamera,
  catalogControls,
  connectionLabel,
  connectionState,
  diagnostics,
  exportControls,
  inspectorOpen,
  initialReviewMode = "review",
  isRatingDisabled,
  isReviewReady,
  library,
  locale,
  onNavigatePhoto,
  onMark,
  onDiagnosticAction,
  onOpenConnectionCheck,
  onOpenSettings,
  onPreviewWindowChange,
  onPrimaryDiagnosticAction,
  onRate,
  onSelectPhoto,
  onToggleInspector,
  onZoomAction,
  ratingError,
  selection,
  shootingReview,
  status,
  tr,
  zoom,
}: {
  activeCamera: CameraDevice | null;
  catalogControls: CatalogControls;
  connectionLabel: string;
  connectionState: CameraConnectionState;
  diagnostics: ConnectionDiagnostics;
  exportControls: ExportControls;
  inspectorOpen: boolean;
  initialReviewMode?: ReviewMode;
  isRatingDisabled: boolean;
  isReviewReady: boolean;
  library: LibraryStats;
  locale: Locale;
  onNavigatePhoto: (offset: -1 | 1) => void;
  onMark: (photo: CameraPhoto, status: PickStatus) => void;
  onDiagnosticAction: (kind: DiagnosticActionKind) => void;
  onOpenConnectionCheck: () => void;
  onOpenSettings: () => void;
  onPreviewWindowChange: (window: { endIndex: number; startIndex: number }) => void;
  onPrimaryDiagnosticAction: () => void;
  onRate: (photo: CameraPhoto, rating: Rating) => void;
  onSelectPhoto: (photoId: string) => void;
  onToggleInspector: () => void;
  onZoomAction: (action: ZoomAction) => void;
  ratingError: string | null;
  selection: WorkspaceSelection;
  shootingReview: ShootingReview;
  status: string;
  tr: Translate;
  zoom: PhotoZoomState;
}) {
  const [activeDrawer, setActiveDrawer] = useState<"camera" | "export" | null>(null);
  const [isFilmstripOpen, setIsFilmstripOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<ReviewMode>(initialReviewMode);
  // 审阅态与选中照片同时成立才渲染照片相关 UI，避免各处重复判空
  const reviewPhoto = isReviewReady ? selection.photo : undefined;
  const isViewMode = reviewMode === "view" && Boolean(reviewPhoto);
  const isFilmstripVisible = isFilmstripOpen && !isViewMode;
  const title = reviewPhoto ? reviewPhoto.fileName : tr("connection.connectCamera");
  const totalCount = selection.catalogView.photos.length;
  const isFiltered = library.visibleCount !== library.photoCount;
  const counterLabel =
    reviewPhoto && totalCount > 0
      ? isFiltered
        ? `${selection.index} / ${totalCount} · ${tr("review.originalCount", { count: library.photoCount })}`
        : `${selection.index} / ${totalCount}`
      : "";
  const viewCounterLabel =
    reviewPhoto && totalCount > 0 ? `${selection.index} / ${totalCount}` : "";
  const exportLabel =
    exportControls.selection.count > 0
      ? tr("export.actionWithCount", { count: exportControls.selection.count })
      : tr("export.actionPending");
  const drawerTopClass = "top-16 max-sm:top-[140px]";
  const headerClass = reviewPhoto
    ? "grid min-h-0 min-w-0 grid-cols-[minmax(330px,1fr)_minmax(150px,0.7fr)_minmax(210px,1fr)] items-center gap-4 border-b border-line bg-panel px-4 py-0 max-nav:grid-cols-[minmax(0,1fr)_auto] max-nav:py-2 max-sm:grid-cols-1 max-sm:gap-3 max-sm:p-3"
    : "grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line bg-panel px-4 py-0 max-sm:grid-cols-1 max-sm:gap-3 max-sm:p-3";
  const leadingGroupClass = reviewPhoto
    ? "flex min-w-0 items-center gap-4"
    : "flex min-w-0 items-center gap-4 overflow-hidden";
  const deviceNameClass = reviewPhoto
    ? "flex min-w-0 items-center gap-2 truncate text-left text-ui-sm font-ui-650 leading-none text-ink transition-colors hover:text-[color-mix(in_oklch,var(--app-ink)_90%,var(--app-focus))] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    : "flex max-w-[168px] shrink-0 items-center gap-2 truncate text-left text-ui-sm font-ui-650 leading-none text-ink transition-colors hover:text-[color-mix(in_oklch,var(--app-ink)_90%,var(--app-focus))] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:max-w-none";
  const workspaceClass = isReviewReady
    ? isViewMode
      ? "relative grid h-full min-h-0 min-w-0 grid-rows-[32px_minmax(0,1fr)] bg-canvas max-sm:min-h-[100vh]"
      : [
          "relative grid h-full min-h-0 min-w-0 bg-canvas max-sm:min-h-0",
          isFilmstripVisible
            ? "grid-rows-[64px_minmax(0,1fr)_88px] max-sm:grid-rows-[auto_minmax(0,auto)_84px]"
            : "grid-rows-[64px_minmax(0,1fr)] max-sm:grid-rows-[auto_minmax(0,auto)]",
        ].join(" ")
    : "relative grid h-full min-h-0 min-w-0 grid-rows-[64px_minmax(0,1fr)] bg-canvas max-sm:min-h-0 max-sm:grid-rows-[auto_minmax(0,auto)]";
  const filmstripToggleLabel = isFilmstripOpen
    ? tr("review.hideFilmstrip")
    : tr("review.showFilmstrip");
  const filmstripNavClass = "relative min-w-0 border-t border-line bg-panel";
  const filmstripToggleClass = [
    "absolute left-1/2 top-1 z-20 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-md border border-line bg-[color-mix(in_oklch,var(--app-surface)_82%,transparent)] text-sm text-muted shadow-[0_8px_22px_color-mix(in_oklch,var(--app-ink)_12%,transparent)] backdrop-blur-sm transition-[background-color,border-color,color,transform] duration-[180ms] ease-[ease] hover:bg-hover hover:text-ink active:-translate-x-1/2 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
  ].join(" ");
  const filmstripInlineToggleClass =
    "grid h-8 w-8 shrink-0 place-items-center rounded-md text-on-image/72 transition-[background-color,color,opacity,transform] duration-[180ms] ease-[ease] hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)] hover:text-on-image active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45";
  const filmstripInlineToggle = (
    <button
      aria-label={filmstripToggleLabel}
      aria-expanded={isFilmstripOpen}
      className={filmstripInlineToggleClass}
      onClick={() => setIsFilmstripOpen(true)}
      title={filmstripToggleLabel}
      type="button"
    >
      <ChevronUp aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
  const feedbackMessage = ratingError ?? (!isReviewReady ? status : null);
  const feedbackClass = [
    "pointer-events-none absolute inset-x-4 z-40 flex justify-end",
    isReviewReady && isFilmstripVisible ? "bottom-[104px]" : "bottom-4",
    "max-sm:inset-x-3 max-sm:bottom-3",
  ].join(" ");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!reviewPhoto || shouldIgnorePhotoReviewShortcut(event.target)) {
        return;
      }

      const shortcut = getPhotoReviewModeShortcut(event.key);

      if (!shortcut) {
        return;
      }

      if (shortcut.type === "toggle") {
        event.preventDefault();
        setActiveDrawer(null);
        setReviewMode((current) => (current === "view" ? "review" : "view"));
        return;
      }

      if (shortcut.type === "exit" && isViewMode) {
        event.preventDefault();
        setReviewMode("review");
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isViewMode, reviewPhoto]);

  return (
    <section className={workspaceClass}>
      {!isViewMode ? (
        <header className={headerClass}>
        <div className={leadingGroupClass}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              className={deviceNameClass}
              onClick={() => setActiveDrawer(activeDrawer === "camera" ? null : "camera")}
              type="button"
            >
              <StatusDot state={connectionState} />
              <span className="min-w-0 truncate">
                {activeCamera?.name ?? connectionLabel}
              </span>
            </button>
          </div>
          {reviewPhoto ? (
            <>
              <span className="h-5 w-px shrink-0 bg-line" aria-hidden="true" />
              <ReviewControls
                disabled={!isReviewReady}
                locale={locale}
                onSortChange={catalogControls.onSortChange}
                sort={catalogControls.sort}
                variant="header"
                visibleCount={library.visibleCount}
              />
            </>
          ) : (
            <p className="min-w-0 flex-1 truncate text-sm text-muted" title={status}>
              {status}
            </p>
          )}
        </div>

        {reviewPhoto ? (
          <div className="min-w-0 text-center max-nav:col-span-2 max-nav:row-start-2 max-sm:col-span-1">
            <div className="flex min-w-0 items-center justify-center gap-2">
              <h2 className="min-w-0 truncate text-[15px] font-ui-600 leading-none text-[color-mix(in_oklch,var(--app-ink)_90%,transparent)]" title={title}>
                {title}
              </h2>
              {reviewPhoto.fileType === "nef" ? (
                <span className="shrink-0 rounded-[4px] border border-line px-1.5 py-0.5 text-[10px] font-ui-760 leading-none text-muted">
                  RAW
                </span>
              ) : null}
            </div>
            {counterLabel ? (
              <p className="mt-1 text-[11px] font-ui-600 leading-none tabular-nums text-[color-mix(in_oklch,var(--app-ink)_50%,transparent)]">
                {counterLabel}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex min-w-0 items-center justify-end gap-2">
          <button
            aria-label={tr("app.details")}
            className={toolbarIconButtonClass}
            onClick={onToggleInspector}
            title={tr("app.details")}
            type="button"
          >
            <Info aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </button>
          {reviewPhoto ? (
            <button
              aria-label={tr("review.enterViewMode")}
              className={toolbarIconButtonClass}
              onClick={() => {
                setActiveDrawer(null);
                setReviewMode("view");
              }}
              title={tr("review.enterViewMode")}
              type="button"
            >
              <Maximize2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </button>
          ) : null}
          {reviewPhoto ? (
            <button
              className="h-8 rounded-lg border border-line bg-[color-mix(in_oklch,var(--app-surface)_84%,var(--app-panel))] px-3 text-ui-sm font-ui-650 leading-8 text-ink transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[ease] hover:bg-hover active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => setActiveDrawer(activeDrawer === "export" ? null : "export")}
              type="button"
            >
              {exportLabel}
            </button>
          ) : null}
          <button
            aria-label={tr("settings.settings")}
            className={toolbarIconButtonClass}
            onClick={onOpenSettings}
            title={tr("settings.settings")}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
        </header>
      ) : null}

      <figure className={`${photoStageClass(isReviewReady)} ${isViewMode ? "row-start-2" : ""}`}>
        {reviewPhoto ? (
          <PhotoStage
            bottomAccessory={isFilmstripVisible ? null : filmstripInlineToggle}
            chromeVisible={!isViewMode}
            disabled={isRatingDisabled}
            infoVisible={inspectorOpen && !isViewMode}
            locale={locale}
            onInfoToggle={onToggleInspector}
            onNext={() => onNavigatePhoto(1)}
            onPrevious={() => onNavigatePhoto(-1)}
            onMark={(status) => onMark(reviewPhoto, status)}
            onRate={(rating) => onRate(reviewPhoto, rating)}
            onZoomAction={onZoomAction}
            photo={reviewPhoto}
            zoom={zoom}
            zoomLabel={formatZoomLabel(zoom, locale)}
          />
        ) : (
          <ConnectionSetup
            diagnostics={diagnostics}
            locale={locale}
            onDiagnosticAction={onDiagnosticAction}
            onOpenConnectionCheck={onOpenConnectionCheck}
            onPrimaryAction={onPrimaryDiagnosticAction}
          />
        )}
      </figure>

      {isViewMode ? (
        <div
          className="row-start-1 flex min-w-0 items-center justify-between gap-3 border-b border-[color-mix(in_oklch,var(--app-line)_34%,transparent)] bg-[color-mix(in_oklch,var(--app-canvas)_76%,transparent)] px-3 text-on-image/62"
          data-view-mode-rail="true"
        >
          {viewCounterLabel ? (
            <div
              aria-label={tr("review.viewCounter", {
                index: selection.index,
                total: totalCount,
              })}
              className="text-ui-xs font-ui-760 tabular-nums"
            >
              {viewCounterLabel}
            </div>
          ) : null}
          <button
            aria-label={tr("review.exitViewMode")}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-on-image/62 transition-[background-color,color,transform] duration-[180ms] ease-[ease] hover:bg-[color-mix(in_oklch,currentColor_8%,transparent)] hover:text-on-image active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => setReviewMode("review")}
            title={tr("review.exitViewMode")}
            type="button"
          >
            <Minimize2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}

      {isReviewReady && isFilmstripVisible ? (
        <nav className={filmstripNavClass}>
          <button
            aria-label={filmstripToggleLabel}
            aria-expanded={isFilmstripOpen}
            className={filmstripToggleClass}
            onClick={() => setIsFilmstripOpen((current) => !current)}
            title={filmstripToggleLabel}
            type="button"
          >
            {isFilmstripOpen ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ChevronUp aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
          <div className="px-2.5 py-2 max-sm:p-2">
            <Filmstrip
              locale={locale}
              onSelect={onSelectPhoto}
              onVisibleWindowChange={onPreviewWindowChange}
              photos={selection.catalogView.photos}
              selectedPhotoId={selection.catalogView.selectedPhotoId}
            />
          </div>
        </nav>
      ) : null}

      {feedbackMessage && !isViewMode ? (
        <div aria-live="polite" className={feedbackClass} role="status">
          <p
            className={[
              "max-w-[min(560px,calc(100vw-32px))] truncate rounded-md border px-3 py-2 text-ui-sm font-ui-760 shadow-[0_14px_36px_color-mix(in_oklch,var(--app-ink)_22%,transparent)] backdrop-blur-sm",
              ratingError
                ? "border-danger-line bg-danger-bg text-danger"
                : "border-line bg-[color-mix(in_oklch,var(--app-panel)_86%,transparent)] text-muted",
            ].join(" ")}
            title={feedbackMessage}
          >
            {feedbackMessage}
          </p>
        </div>
      ) : null}

      {activeDrawer && !isViewMode ? (
        <aside className={`absolute bottom-0 left-0 ${drawerTopClass} z-30 w-[320px] max-w-[calc(100vw-28px)] overflow-y-auto border-r border-line bg-panel p-4 shadow-[18px_0_50px_color-mix(in_oklch,var(--app-ink)_24%,transparent)]`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="section-label">
              {activeDrawer === "camera" ? tr("connection.device") : tr("export.title")}
            </h3>
            <button
              className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-hover"
              onClick={() => setActiveDrawer(null)}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          {activeDrawer === "camera" ? (
            <>
              <section className="space-y-3">
                <p className="text-ui-5xl font-ui-760 text-ink">
                  {activeCamera?.name ?? tr("connection.noCamera")}
                </p>
                <p className="text-sm text-muted">
                  {activeCamera
                    ? formatConnection(activeCamera.connection, locale)
                    : status}
                </p>
              </section>
              <ConnectionDiagnosticPanel
                diagnostics={diagnostics}
                locale={locale}
                onOpen={onOpenConnectionCheck}
              />
              <ShootingReviewPanel
                disabled={!isReviewReady}
                locale={locale}
                review={shootingReview}
              />
            </>
          ) : (
            <ExportPanel
              disabled={!isReviewReady}
              destination={exportControls.destination}
              exportCount={exportControls.selection.count}
              exportSizeMb={exportControls.selection.sizeMb}
              locale={locale}
              mode={exportControls.mode}
              onDestinationChange={exportControls.onDestinationChange}
              onExport={exportControls.onExport}
              onModeChange={exportControls.onModeChange}
              status={exportControls.status}
            />
          )}
        </aside>
      ) : null}

      {inspectorOpen && !reviewPhoto ? (
        <aside className={`absolute bottom-0 right-0 ${drawerTopClass} z-30 w-[292px] max-w-[calc(100vw-28px)] overflow-y-auto border-l border-line bg-panel p-4 shadow-[-18px_0_50px_color-mix(in_oklch,var(--app-ink)_24%,transparent)]`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="section-label">{tr("app.details")}</h3>
            <button
              className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-hover"
              onClick={onToggleInspector}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          {reviewPhoto ? <PhotoDetails locale={locale} photo={reviewPhoto} /> : <EmptyPhotoDetails locale={locale} />}
        </aside>
      ) : null}
    </section>
  );
}

const toolbarIconButtonClass =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-[color-mix(in_oklch,var(--app-surface)_84%,var(--app-panel))] text-[color-mix(in_oklch,var(--app-ink)_78%,transparent)] transition-[background-color,border-color,color,transform] duration-[180ms] ease-[ease] hover:bg-hover hover:text-ink active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";
