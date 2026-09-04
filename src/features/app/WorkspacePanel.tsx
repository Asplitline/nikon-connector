import { ConnectionSetup, EmptyPhotoDetails } from "../photos/ConnectionPanels";
import type { ConnectionDiagnostics } from "../photos/connectionDiagnostics";
import { PhotoDetails } from "../photos/PhotoDetails";
import { Filmstrip, PhotoStage } from "../photos/PhotoStage";
import { StarRating } from "../photos/StarRating";
import type { CameraPhoto, PhotoCatalogState, Rating } from "../photos/types";
import { formatZoomLabel } from "../photos/zoom";
import type { PhotoZoomState, ZoomAction } from "../photos/zoom";
import type { Locale, t as translate } from "../../i18n";

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
  diagnostics,
  isRatingDisabled,
  isReviewReady,
  locale,
  onOpenConnectionCheck,
  onPrimaryDiagnosticAction,
  onRate,
  onSelectPhoto,
  onZoomAction,
  ratingError,
  selection,
  status,
  tr,
  zoom,
}: {
  diagnostics: ConnectionDiagnostics;
  isRatingDisabled: boolean;
  isReviewReady: boolean;
  locale: Locale;
  onOpenConnectionCheck: () => void;
  onPrimaryDiagnosticAction: () => void;
  onRate: (photo: CameraPhoto, rating: Rating) => void;
  onSelectPhoto: (photoId: string) => void;
  onZoomAction: (action: ZoomAction) => void;
  ratingError: string | null;
  selection: WorkspaceSelection;
  status: string;
  tr: Translate;
  zoom: PhotoZoomState;
}) {
  // 审阅态与选中照片同时成立才渲染照片相关 UI，避免各处重复判空
  const reviewPhoto = isReviewReady ? selection.photo : undefined;
  const title = reviewPhoto ? reviewPhoto.fileName : tr("connection.connectCamera");

  return (
    <section className="workspace grid h-full min-h-0 grid-rows-[84px_minmax(0,1fr)_156px] max-nav:grid-rows-[auto_minmax(0,1fr)_144px] max-sm:grid-rows-[auto_minmax(0,auto)_142px] max-sm:min-h-0">
      <header className="top-bar flex min-h-0 items-center justify-between gap-5 border-b border-line px-6 py-4 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:p-4">
        <div className="min-w-0">
          <p className="min-w-0 truncate wrap-anywhere text-sm text-muted" title={status}>
            {status}
          </p>
          <h2
            className="min-w-0 mt-1 truncate text-2xl font-semibold leading-tight"
            title={title}
          >
            {title}
          </h2>
        </div>
        <div className="top-actions flex shrink-0 items-center gap-4 max-sm:w-full max-sm:items-start max-sm:justify-between">
          {reviewPhoto ? (
            <>
              <span className="photo-count whitespace-nowrap text-sm font-medium text-muted max-sm:order-2 max-sm:pt-3.5">
                {selection.index} / {selection.catalogView.photos.length}
              </span>
              <StarRating
                disabled={isRatingDisabled}
                labels={{
                  clear: tr("rating.clear"),
                  rating: (value) => tr("rating.label", { value }),
                  star: (value) => tr("rating.star", { value }),
                }}
                onChange={(rating) => onRate(reviewPhoto, rating)}
                value={reviewPhoto.rating}
              />
            </>
          ) : null}
        </div>
      </header>

      <div className="review-area grid min-h-0 grid-cols-[minmax(0,1fr)_232px] max-nav:grid-cols-1 max-nav:grid-rows-[minmax(0,1fr)_auto] max-sm:min-h-0">
        <figure
          className={[
            "photo-stage relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6 max-sm:min-h-[42vh] max-sm:p-4",
            isReviewReady ? "" : "empty",
          ].join(" ")}
        >
          {reviewPhoto ? (
            <PhotoStage
              locale={locale}
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

        <aside className="details-panel min-h-0 overflow-y-auto border-l border-line bg-panel p-5 max-nav:border-l-0 max-nav:border-t max-nav:px-4 max-nav:py-3.5">
          <h3 className="section-label">{tr("app.details")}</h3>
          {reviewPhoto ? <PhotoDetails locale={locale} photo={reviewPhoto} /> : null}
          {isReviewReady ? null : <EmptyPhotoDetails locale={locale} />}
          {ratingError ? (
            <p className="mt-6 rounded-lg border border-danger-line bg-danger-bg p-3 text-sm leading-6 text-danger">
              {ratingError}
            </p>
          ) : null}
        </aside>
      </div>

      <nav className="filmstrip min-w-0 border-t border-line bg-panel px-4 py-3 max-sm:p-3">
        {isReviewReady ? (
          <Filmstrip
            locale={locale}
            onSelect={onSelectPhoto}
            photos={selection.catalogView.photos}
            selectedPhotoId={selection.catalogView.selectedPhotoId}
          />
        ) : null}
      </nav>
    </section>
  );
}
