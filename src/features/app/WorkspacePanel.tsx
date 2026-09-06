import { useState } from "react";
import {
  ConnectionDiagnosticPanel,
  ConnectionSetup,
  EmptyPhotoDetails,
} from "../photos/ConnectionPanels";
import type { ConnectionDiagnostics } from "../photos/connectionDiagnostics";
import { ExportPanel } from "../photos/ExportPanel";
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
  isRatingDisabled,
  isReviewReady,
  library,
  locale,
  onNavigatePhoto,
  onMark,
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
  isRatingDisabled: boolean;
  isReviewReady: boolean;
  library: LibraryStats;
  locale: Locale;
  onNavigatePhoto: (offset: -1 | 1) => void;
  onMark: (photo: CameraPhoto, status: PickStatus) => void;
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
  // 审阅态与选中照片同时成立才渲染照片相关 UI，避免各处重复判空
  const reviewPhoto = isReviewReady ? selection.photo : undefined;
  const title = reviewPhoto ? reviewPhoto.fileName : tr("connection.connectCamera");
  const totalCount = selection.catalogView.photos.length;
  const isFiltered = library.visibleCount !== library.photoCount;
  const counterLabel =
    reviewPhoto && totalCount > 0
      ? isFiltered
        ? `${selection.index} / ${totalCount} · ${tr("review.originalCount", { count: library.photoCount })}`
        : `${selection.index} / ${totalCount}`
      : "";
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

  return (
    <section
      className={
        isReviewReady
          ? "relative grid h-full min-h-0 min-w-0 grid-rows-[64px_minmax(0,1fr)_88px_34px] bg-canvas max-sm:min-h-0 max-sm:grid-rows-[auto_minmax(0,auto)_84px_auto]"
          : "relative grid h-full min-h-0 min-w-0 grid-rows-[64px_minmax(0,1fr)_30px] bg-canvas max-sm:min-h-0 max-sm:grid-rows-[auto_minmax(0,auto)_auto]"
      }
    >
      <header className={headerClass}>
        <div className={leadingGroupClass}>
          <button
            aria-label={tr("connection.device")}
            className={toolbarIconButtonClass}
            onClick={() => setActiveDrawer(activeDrawer === "camera" ? null : "camera")}
            title={tr("connection.device")}
            type="button"
          >
            <SidebarIcon />
          </button>
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
                filter={catalogControls.filter}
                locale={locale}
                onFilterChange={catalogControls.onFilterChange}
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
            <InfoIcon />
          </button>
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
            <MoreIcon />
          </button>
        </div>
      </header>

      <figure className={photoStageClass(isReviewReady)}>
        {reviewPhoto ? (
          <PhotoStage
            disabled={isRatingDisabled}
            locale={locale}
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
            onOpenConnectionCheck={onOpenConnectionCheck}
            onPrimaryAction={onPrimaryDiagnosticAction}
          />
        )}
      </figure>

      {isReviewReady ? (
        <nav className="min-w-0 border-t border-line bg-panel px-2.5 py-2 max-sm:p-2">
          <Filmstrip
            locale={locale}
            onSelect={onSelectPhoto}
            onVisibleWindowChange={onPreviewWindowChange}
            photos={selection.catalogView.photos}
            selectedPhotoId={selection.catalogView.selectedPhotoId}
          />
        </nav>
      ) : null}

      <footer className="flex min-w-0 items-center justify-between gap-3 border-t border-line bg-panel px-4 text-ui-sm font-ui-760 text-muted max-sm:flex-wrap max-sm:py-2">
        <span className="min-w-0 truncate">
          {isReviewReady
            ? tr("review.statusSummary", {
                keepers: shootingReview.keepers,
                rated: library.ratedCount,
                total: library.photoCount,
              })
            : status}
        </span>
        {ratingError ? <span className="truncate text-danger">{ratingError}</span> : null}
      </footer>

      {activeDrawer ? (
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
              ×
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

      {inspectorOpen ? (
        <aside className={`absolute bottom-0 right-0 ${drawerTopClass} z-30 w-[292px] max-w-[calc(100vw-28px)] overflow-y-auto border-l border-line bg-panel p-4 shadow-[-18px_0_50px_color-mix(in_oklch,var(--app-ink)_24%,transparent)]`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h3 className="section-label">{tr("app.details")}</h3>
            <button
              className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-hover"
              onClick={onToggleInspector}
              type="button"
            >
              ×
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

function SidebarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      <rect height="11" rx="2" width="12" x="2" y="2.5" />
      <path d="M6 3v10" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.3v3.4" />
      <path d="M8 5.15h.01" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 16 16"
    >
      <path d="M4.25 8h.01" />
      <path d="M8 8h.01" />
      <path d="M11.75 8h.01" />
    </svg>
  );
}
