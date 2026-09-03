import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import {
  createPhotoCatalog,
  getCatalogView,
  getSelectedPhoto,
  type PhotoCatalogFilter,
  type PhotoCatalogSort,
  selectPhoto,
  selectPhotoByOffset,
  selectPhotoEdge,
  updatePhotoRating,
} from "./features/photos/catalog";
import {
  getPhotoReviewShortcut,
  shouldIgnorePhotoReviewShortcut,
} from "./features/photos/keyboard";
import {
  createExportSelection,
  type ExportMode,
} from "./features/photos/exportPlan";
import {
  applyLocalRatings,
  isLocalOnlyRatingError,
  readLocalRatings,
  writeLocalRating,
} from "./features/photos/localRatings";
import {
  createConnectionDiagnostics,
  type DiagnosticActionKind,
  type ConnectionDiagnostics,
  type ConnectionDiagnosticStep,
} from "./features/photos/connectionDiagnostics";
import { StarRating } from "./features/photos/StarRating";
import type {
  CameraConnectionState,
  CameraDevice,
  CameraPhoto,
  PhotoCatalogState,
  Rating,
} from "./features/photos/types";
import {
  applyZoomAction,
  createFitZoomState,
  type PhotoZoomState,
} from "./features/photos/zoom";
import {
  createShootingReview,
  type ShootingReview,
} from "./features/photos/shootingReview";
import { defaultLocale, locales, type Locale, t } from "./i18n";
import {
  checkForUpdate,
  getAppInfo,
  installPendingUpdate,
  type AppInfo,
  type AvailableUpdate,
} from "./lib/appApi";
import { exportPhotos, listCameras, listPhotos, setPhotoRating } from "./lib/cameraApi";
import "./index.css";

type UpdateStatus =
  | { state: "idle"; message: string }
  | { state: "checking"; message: string }
  | { state: "available"; message: string; update: AvailableUpdate }
  | { state: "installing"; message: string }
  | { state: "error"; message: string };

export type ThemeMode = "light" | "dark";

type ExportStatus = "idle" | "exporting" | "complete" | "error";

function imageSource(url: string) {
  return !url || /^(https?:|asset:|data:|blob:)/i.test(url)
    ? url
    : convertFileSrc(url);
}

function App() {
  const [connectionState, setConnectionState] =
    useState<CameraConnectionState>("loading");
  const [activeCamera, setActiveCamera] = useState<CameraDevice | null>(null);
  const [catalog, setCatalog] = useState<PhotoCatalogState>(() =>
    createPhotoCatalog([]),
  );
  const [status, setStatus] = useState(t("status.scanning"));
  const [scanError, setScanError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PhotoZoomState>(() => createFitZoomState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionCheckOpen, setConnectionCheckOpen] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<PhotoCatalogFilter>("all");
  const [catalogSort, setCatalogSort] = useState<PhotoCatalogSort>("captured_asc");
  const [exportMode, setExportMode] = useState<ExportMode>("visible");
  const [exportDestination, setExportDestination] = useState("");
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
    message: t("status.notChecked"),
  });
  const tr = useCallback(
    (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) =>
      t(key, values, locale),
    [locale],
  );

  const loadCamera = useCallback(async () => {
    try {
      setConnectionState("loading");
      setScanError(null);
      const nextCameras = await listCameras();

      if (nextCameras.length === 0) {
        setActiveCamera(null);
        setCatalog(createPhotoCatalog([]));
        setConnectionState("not_connected");
        setStatus(tr("status.connectUsb"));
        return;
      }

      const nextCamera = nextCameras[0];
      const nextPhotos = applyLocalRatings(
        await listPhotos(nextCamera.id),
        readLocalRatings(window.localStorage, nextCamera.id),
      );
      setActiveCamera(nextCamera);
      setCatalog(createPhotoCatalog(nextPhotos));
      if (nextCamera.connection === "mock") {
        setConnectionState("not_connected");
        setStatus(tr("status.demo"));
        return;
      }
      setConnectionState("connected");
      setStatus(
        tr("status.mountedPhotos", {
          camera: nextCamera.name,
          count: nextPhotos.length,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.cameraScanFailed");
      setActiveCamera(null);
      setCatalog(createPhotoCatalog([]));
      setScanError(message);
      setConnectionState("error");
      setStatus(message);
    }
  }, [tr]);

  useEffect(() => {
    void Promise.resolve().then(loadCamera);
  }, [loadCamera]);

  const catalogView = useMemo(
    () =>
      getCatalogView(catalog, {
        filter: catalogFilter,
        sort: catalogSort,
      }),
    [catalog, catalogFilter, catalogSort],
  );
  const selectedPhoto = useMemo(() => getSelectedPhoto(catalogView), [catalogView]);
  const selectedIndex = selectedPhoto
    ? catalogView.photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1
    : 0;
  const isRealCamera = activeCamera?.connection !== "mock";
  const ratedCount =
    connectionState === "connected" && isRealCamera
      ? catalog.photos.filter((photo) => photo.rating > 0).length
      : 0;
  const connectionDiagnostics = useMemo(
    () =>
      createConnectionDiagnostics({
        camera: activeCamera,
        connectionState,
        locale,
        photoCount: catalog.photos.length,
        scanError,
      }),
    [activeCamera, catalog.photos.length, connectionState, locale, scanError],
  );
  const isReviewReady =
    connectionState === "connected" &&
    isRealCamera &&
    catalog.photos.length > 0;
  const connectionLabel =
    isReviewReady
      ? tr("connection.ready")
      : connectionState === "loading"
        ? tr("connection.scanning")
        : connectionState === "error"
          ? tr("connection.needsAttention")
          : tr("connection.noCamera");
  const zoomLabel =
    zoom.mode === "fit" ? tr("zoom.fit") : `${Math.round(zoom.scale * 100)}%`;
  const exportSelection = useMemo(
    () =>
      createExportSelection({
        mode: exportMode,
        photos: catalog.photos,
        selectedPhotoId: selectedPhoto?.id ?? null,
        visiblePhotos: catalogView.photos,
      }),
    [catalog.photos, catalogView.photos, exportMode, selectedPhoto?.id],
  );
  const shootingReview = useMemo(
    () => createShootingReview(catalog.photos),
    [catalog.photos],
  );

  const handleOpenImageCapture = useCallback(async () => {
    try {
      await openPath("/System/Applications/Image Capture.app");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : tr("status.couldNotOpenImageCapture"),
      );
    }
  }, [tr]);

  const runDiagnosticAction = useCallback(async (kind: DiagnosticActionKind) => {
    if (kind === "open_camera_privacy" || kind === "open_macos_privacy") {
      try {
        await openUrl("x-apple.systempreferences:com.apple.preference.security?Privacy_Camera");
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : tr("status.couldNotOpenPrivacy"),
        );
      }
      return;
    }

    if (kind === "open_image_capture") {
      await handleOpenImageCapture();
      return;
    }

    if (kind === "rescan") {
      await loadCamera();
    }
  }, [handleOpenImageCapture, loadCamera, tr]);

  const handlePrimaryDiagnosticAction = useCallback(async () => {
    await runDiagnosticAction(connectionDiagnostics.primaryAction.kind);
  }, [connectionDiagnostics.primaryAction.kind, runDiagnosticAction]);

  useEffect(() => {
    void getAppInfo().then(setAppInfo).catch((error) => {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : tr("status.couldNotReadAppInfo"),
      });
    });
  }, [tr]);

  const handleCheckForUpdate = useCallback(async () => {
    setUpdateStatus({ state: "checking", message: tr("status.updateChecking") });

    try {
      const update = await checkForUpdate();

      if (!update) {
        setUpdateStatus({
          state: "idle",
          message: tr("status.noUpdate"),
        });
        return;
      }

      setUpdateStatus({
        state: "available",
        message: tr("status.updateAvailable", { version: update.version }),
        update,
      });
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : tr("status.updateCheckFailed"),
      });
    }
  }, [tr]);

  useEffect(() => {
    if (!autoUpdateEnabled || !appInfo) {
      return;
    }

    void Promise.resolve().then(handleCheckForUpdate);
  }, [appInfo, autoUpdateEnabled, handleCheckForUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    setUpdateStatus({ state: "installing", message: tr("status.downloading") });

    try {
      await installPendingUpdate((event) => {
        if (event.event === "Started") {
          setUpdateStatus({
            state: "installing",
            message: event.data.contentLength
              ? tr("status.downloadingSize", {
                  size: formatBytes(event.data.contentLength),
                })
              : tr("status.downloading"),
          });
          return;
        }

        if (event.event === "Finished") {
          setUpdateStatus({
            state: "installing",
            message: tr("status.installing"),
          });
        }
      });
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : tr("status.updateInstallFailed"),
      });
    }
  }, [tr]);

  const handleRatingChange = useCallback(async (photo: CameraPhoto, rating: Rating) => {
    setRatingError(null);
    setCatalog((current) => updatePhotoRating(current, photo.id, rating));
    writeLocalRating(window.localStorage, photo.cameraId, photo.id, rating);

    try {
      await setPhotoRating(photo.id, rating);
      setStatus(tr("status.ratingSaved", { rating, fileName: photo.fileName }));
    } catch (error) {
      if (isLocalOnlyRatingError(error)) {
        setStatus(tr("status.ratingLocalSaved", { rating, fileName: photo.fileName }));
        setRatingError(tr("status.ratingLocalOnly"));
        return;
      }

      setCatalog((current) => updatePhotoRating(current, photo.id, photo.rating));
      writeLocalRating(window.localStorage, photo.cameraId, photo.id, photo.rating);
      setRatingError(
        error instanceof Error
          ? error.message
          : tr("status.ratingWriteFailed"),
      );
    }
  }, [tr]);

  const handleExport = useCallback(async () => {
    if (!activeCamera || exportSelection.photoIds.length === 0) {
      return;
    }

    const destinationDir = exportDestination.trim();
    if (!destinationDir) {
      setExportStatus("error");
      setStatus(tr("status.exportNeedsDestination"));
      return;
    }

    setExportStatus("exporting");

    try {
      const summary = await exportPhotos({
        cameraId: activeCamera.id,
        destinationDir,
        photoIds: exportSelection.photoIds,
      });
      setExportStatus(summary.failed > 0 ? "error" : "complete");
      setStatus(
        tr("status.exportComplete", {
          copied: summary.copied,
          failed: summary.failed,
          skipped: summary.skipped,
        }),
      );
    } catch (error) {
      setExportStatus("error");
      setStatus(error instanceof Error ? error.message : tr("status.exportFailed"));
    }
  }, [activeCamera, exportDestination, exportSelection.photoIds, tr]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnorePhotoReviewShortcut(event.target)) {
        return;
      }

      const shortcut = getPhotoReviewShortcut(event.key);

      if (!shortcut) {
        return;
      }

      if (shortcut.type === "move") {
        event.preventDefault();
        setZoom(createFitZoomState());
        setCatalog((current) => {
          const visible = getCatalogView(current, {
            filter: catalogFilter,
            sort: catalogSort,
          });
          return {
            ...current,
            selectedPhotoId: selectPhotoByOffset(visible, shortcut.offset).selectedPhotoId,
          };
        });
        return;
      }

      if (shortcut.type === "edge") {
        event.preventDefault();
        setZoom(createFitZoomState());
        setCatalog((current) => {
          const visible = getCatalogView(current, {
            filter: catalogFilter,
            sort: catalogSort,
          });
          return {
            ...current,
            selectedPhotoId: selectPhotoEdge(visible, shortcut.edge).selectedPhotoId,
          };
        });
        return;
      }

      if (shortcut.type === "rate" && connectionState === "connected" && selectedPhoto) {
        event.preventDefault();
        void handleRatingChange(selectedPhoto, shortcut.rating);
        return;
      }

      if (shortcut.type === "zoom" && selectedPhoto) {
        event.preventDefault();
        setZoom((current) => applyZoomAction(current, shortcut.action));
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [catalogFilter, catalogSort, connectionState, handleRatingChange, selectedPhoto]);

  return (
    <main
      className="app-shell h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]"
      data-theme={theme}
    >
      <div className="app-frame grid h-full min-h-0 grid-cols-[248px_minmax(0,1fr)]">
        <aside className="side-panel min-h-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-5">
          <div className="brand-row flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                {tr("app.name")}
              </p>
              <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-normal text-[var(--color-ink)]">
                {tr("app.cameraCard")}
              </h1>
            </div>
            <span className="status-pill mt-0.5">
              <span
                aria-hidden="true"
                className={[
                  "h-2 w-2 rounded-full",
                  connectionState === "connected"
                    ? "bg-[var(--color-ready)]"
                    : connectionState === "error"
                      ? "bg-[var(--color-danger)]"
                      : "bg-[var(--color-muted)]",
                ].join(" ")}
              />
              <span>{connectionLabel}</span>
            </span>
          </div>

          <section className="mt-8 space-y-3">
            <p className="section-label">{tr("connection.device")}</p>
            {activeCamera && activeCamera.connection !== "mock" ? (
              <div className="device-card rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
                <p
                  className="device-name text-base font-semibold leading-snug"
                  title={activeCamera.name}
                >
                  {activeCamera.name}
                </p>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">
                  {formatConnection(activeCamera.connection, locale)}
                </p>
              </div>
            ) : (
              <div className="empty-device rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm leading-6 text-[var(--color-muted)]">
                {status}
              </div>
            )}
          </section>

          <ConnectionDiagnosticPanel
            diagnostics={connectionDiagnostics}
            locale={locale}
            onOpen={() => setConnectionCheckOpen(true)}
          />

          <ReviewControls
            disabled={!isReviewReady}
            filter={catalogFilter}
            locale={locale}
            onFilterChange={setCatalogFilter}
            onSortChange={setCatalogSort}
            sort={catalogSort}
            visibleCount={isReviewReady ? catalogView.photos.length : 0}
          />

          <ExportPanel
            disabled={!isReviewReady || exportSelection.count === 0}
            destination={exportDestination}
            exportCount={exportSelection.count}
            exportSizeMb={exportSelection.sizeMb}
            locale={locale}
            mode={exportMode}
            onDestinationChange={setExportDestination}
            onExport={() => void handleExport()}
            onModeChange={setExportMode}
            status={exportStatus}
          />

          <ShootingReviewPanel
            disabled={!isReviewReady}
            locale={locale}
            review={shootingReview}
          />

          <section className="mt-8 space-y-3">
            <p className="section-label">{tr("connection.library")}</p>
            <dl className="library-stats grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-[var(--color-surface)] px-3 py-3">
                <dt className="text-[var(--color-muted)]">{tr("connection.photos")}</dt>
                <dd className="mt-1.5 text-2xl font-semibold leading-none">
                  {isReviewReady ? catalog.photos.length : 0}
                </dd>
              </div>
              <div className="rounded-md bg-[var(--color-surface)] px-3 py-3">
                <dt className="text-[var(--color-muted)]">{tr("connection.rated")}</dt>
                <dd className="mt-1.5 text-2xl font-semibold leading-none">{ratedCount}</dd>
              </div>
            </dl>
          </section>

          <button
            className="settings-entry mt-8 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3 text-left text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            ⚙ {tr("settings.settings")}
          </button>
        </aside>

        <section className="workspace grid h-full min-h-0 grid-rows-[84px_minmax(0,1fr)_156px]">
          <header className="top-bar flex min-h-0 items-center justify-between gap-5 border-b border-[var(--color-line)] px-6 py-4">
            <div className="min-w-0">
              <p className="status-text truncate text-sm text-[var(--color-muted)]" title={status}>
                {status}
              </p>
              <h2
                className="file-title mt-1 truncate text-2xl font-semibold leading-tight"
                title={
                  isReviewReady && selectedPhoto
                    ? selectedPhoto.fileName
                    : tr("connection.connectCamera")
                }
              >
                {isReviewReady && selectedPhoto
                  ? selectedPhoto.fileName
                  : tr("connection.connectCamera")}
              </h2>
            </div>
            <div className="top-actions flex shrink-0 items-center gap-4">
              {isReviewReady && selectedPhoto ? (
                <span className="photo-count whitespace-nowrap text-sm font-medium text-[var(--color-muted)]">
                  {selectedIndex} / {catalogView.photos.length}
                </span>
              ) : null}
              {isReviewReady && selectedPhoto ? (
                <StarRating
                  disabled={connectionState !== "connected"}
                  labels={{
                    clear: tr("rating.clear"),
                    rating: (value) => tr("rating.label", { value }),
                    star: (value) => tr("rating.star", { value }),
                  }}
                  onChange={(rating) => void handleRatingChange(selectedPhoto, rating)}
                  value={selectedPhoto.rating}
                />
              ) : null}
            </div>
          </header>

          <div className="review-area grid min-h-0 grid-cols-[minmax(0,1fr)_232px]">
            <figure
              className={[
                "photo-stage relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6",
                isReviewReady ? "" : "empty",
              ].join(" ")}
            >
              {isReviewReady && selectedPhoto ? (
                <>
                  <div className="zoom-toolbar absolute left-5 top-5 z-10 flex items-center gap-1.5 rounded-lg border border-[var(--color-stage-line)] bg-[var(--color-stage-toolbar)] p-1 text-[var(--color-on-image)]">
                    <button
                      aria-label={tr("zoom.out")}
                      className="zoom-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "out"))}
                      title={tr("zoom.outTitle")}
                      type="button"
                    >
                      −
                    </button>
                    <span className="zoom-readout">{zoomLabel}</span>
                    <button
                      aria-label={tr("zoom.in")}
                      className="zoom-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "in"))}
                      title={tr("zoom.inTitle")}
                      type="button"
                    >
                      +
                    </button>
                    <button
                      className="zoom-text-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "fit"))}
                      title={tr("zoom.fitTitle")}
                      type="button"
                    >
                      {tr("zoom.fit")}
                    </button>
                    <button
                      className="zoom-text-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "actual"))}
                      title={tr("zoom.actual")}
                      type="button"
                    >
                      {tr("zoom.actual")}
                    </button>
                  </div>
                  {selectedPhoto.previewUrl || selectedPhoto.thumbnailUrl ? (
                    <img
                      alt={selectedPhoto.fileName}
                      className={[
                        "review-image rounded-md object-contain",
                        zoom.mode === "fit" ? "max-h-full max-w-full" : "scaled",
                      ].join(" ")}
                      src={imageSource(selectedPhoto.previewUrl || selectedPhoto.thumbnailUrl)}
                      style={
                        zoom.mode === "scaled"
                          ? { transform: `scale(${zoom.scale})` }
                          : undefined
                      }
                    />
                  ) : (
                    <div className="text-center text-[var(--color-stage-muted)]">
                      {tr("photo.previewUnavailable")}
                    </div>
                  )}
                </>
              ) : (
                <ConnectionSetup
                  diagnostics={connectionDiagnostics}
                  locale={locale}
                  onOpenConnectionCheck={() => setConnectionCheckOpen(true)}
                  onPrimaryAction={() => void handlePrimaryDiagnosticAction()}
                />
              )}
            </figure>

            <aside className="details-panel min-h-0 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <h3 className="section-label">
                {tr("app.details")}
              </h3>
              {isReviewReady && selectedPhoto ? (
                <PhotoDetails locale={locale} photo={selectedPhoto} />
              ) : null}
              {!isReviewReady ? <EmptyPhotoDetails locale={locale} /> : null}
              {ratingError ? (
                <p className="mt-6 rounded-lg border border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] p-3 text-sm leading-6 text-[var(--color-danger)]">
                  {ratingError}
                </p>
              ) : null}
            </aside>
          </div>

          <nav className="filmstrip min-w-0 overflow-x-auto border-t border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
            <div className="flex min-w-max gap-3">
              {isReviewReady ? catalogView.photos.map((photo) => {
                const isSelected = photo.id === catalogView.selectedPhotoId;

                return (
                  <button
                    className={[
                      "thumb group relative h-[116px] w-[148px] overflow-hidden rounded-lg border bg-[var(--color-surface)] text-left transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
                      isSelected
                        ? "selected border-[var(--color-ink)]"
                        : "border-[var(--color-line)] hover:border-[var(--color-muted)]",
                    ].join(" ")}
                    aria-current={isSelected ? "true" : undefined}
                    key={photo.id}
                    onClick={() => {
                      setZoom(createFitZoomState());
                      setCatalog((current) => selectPhoto(current, photo.id));
                    }}
                    title={photo.fileName}
                    type="button"
                  >
                    {photo.thumbnailUrl ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                        src={imageSource(photo.thumbnailUrl)}
                      />
                    ) : null}
                    <span className="thumb-caption absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-2.5 pt-9 text-xs font-medium text-[var(--color-on-image)]">
                      <span className="min-w-0 truncate">{photo.fileName}</span>
                      <span className="shrink-0">
                        {photo.rating ? `${photo.rating}★` : tr("app.unrated")}
                      </span>
                    </span>
                  </button>
                );
              }) : null}
            </div>
          </nav>
        </section>
      </div>
      {settingsOpen ? (
        <SettingsPanel
          appInfo={appInfo}
          autoUpdateEnabled={autoUpdateEnabled}
          locale={locale}
          onCheckForUpdate={() => void handleCheckForUpdate()}
          onClose={() => setSettingsOpen(false)}
          onInstallUpdate={() => void handleInstallUpdate()}
          onLocaleChange={setLocale}
          onThemeChange={setTheme}
          onToggleAutoUpdate={setAutoUpdateEnabled}
          theme={theme}
          updateStatus={updateStatus}
        />
      ) : null}
      {connectionCheckOpen ? (
        <ConnectionDiagnosticDialog
          diagnostics={connectionDiagnostics}
          locale={locale}
          onAction={(kind) => void runDiagnosticAction(kind)}
          onClose={() => setConnectionCheckOpen(false)}
          onOpenImageCapture={() => void handleOpenImageCapture()}
          onPrimaryAction={() => void handlePrimaryDiagnosticAction()}
        />
      ) : null}
    </main>
  );
}

export function ConnectionDiagnosticPanel({
  diagnostics,
  locale = defaultLocale,
  onOpen,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onOpen: () => void;
}) {
  return (
    <section className="connection-check mt-8 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("connection.check", undefined, locale)}</p>
        <span className={`diagnostic-summary ${diagnostics.severity}`}>
          {diagnostics.summary}
        </span>
      </div>
      <p className="connection-check-copy">
        {t("connection.checkCopy", undefined, locale)}
      </p>
      <button className="secondary-button compact" onClick={onOpen} type="button">
        {t("connection.checkOpen", undefined, locale)}
      </button>
    </section>
  );
}

export function ConnectionSetup({
  diagnostics,
  locale = defaultLocale,
  onOpenConnectionCheck,
  onPrimaryAction,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onOpenConnectionCheck: () => void;
  onPrimaryAction: () => void;
}) {
  const blockingStep = diagnostics.steps.find(
    (step) => step.id === diagnostics.blockingStepId,
  );

  return (
    <section className="connection-setup">
      <p className={`connection-kicker ${diagnostics.severity}`}>
        {diagnostics.summary}
      </p>
      <h2>{blockingStep?.label ?? t("connection.cameraConnected", undefined, locale)}</h2>
      <p className="connection-next-step">
        {blockingStep?.detail ?? t("connection.cameraReadyForReview", undefined, locale)}
      </p>
      <div className="connection-action-row">
        <button
          className="primary-button"
          disabled={diagnostics.primaryAction.kind === "none"}
          onClick={onPrimaryAction}
          type="button"
        >
          {diagnostics.primaryAction.label}
        </button>
        <button className="secondary-button" onClick={onOpenConnectionCheck} type="button">
          {t("connection.checkOpen", undefined, locale)}
        </button>
      </div>
    </section>
  );
}

const catalogFilterOptions: PhotoCatalogFilter[] = [
  "all",
  "unrated",
  "rated",
  "rating_3_plus",
  "rating_4_plus",
  "rating_5",
];

const catalogSortOptions: PhotoCatalogSort[] = [
  "captured_asc",
  "filename_asc",
  "rating_desc",
];

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
    <section className="review-controls mt-8 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("review.culling", undefined, locale)}</p>
        <span className="visible-count">
          {t("review.visibleCount", { count: visibleCount }, locale)}
        </span>
      </div>

      <label className="control-field">
        <span>{t("review.filter", undefined, locale)}</span>
        <select
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

      <label className="control-field">
        <span>{t("review.sort", undefined, locale)}</span>
        <select
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

const exportModeOptions: ExportMode[] = [
  "visible",
  "rating_3_plus",
  "rating_4_plus",
  "rating_5",
  "current",
];

export function ExportPanel({
  destination,
  disabled = false,
  exportCount,
  exportSizeMb,
  locale = defaultLocale,
  mode,
  onDestinationChange,
  onExport,
  onModeChange,
  status,
}: {
  destination: string;
  disabled?: boolean;
  exportCount: number;
  exportSizeMb: number;
  locale?: Locale;
  mode: ExportMode;
  onDestinationChange: (destination: string) => void;
  onExport: () => void;
  onModeChange: (mode: ExportMode) => void;
  status: ExportStatus;
}) {
  return (
    <section className="export-panel mt-8 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("export.title", undefined, locale)}</p>
        <span className={`export-status ${status}`}>
          {formatExportStatus(status, locale)}
        </span>
      </div>

      <label className="control-field">
        <span>{t("export.mode", undefined, locale)}</span>
        <select
          disabled={disabled}
          onChange={(event) => onModeChange(event.target.value as ExportMode)}
          value={mode}
        >
          {exportModeOptions.map((option) => (
            <option key={option} value={option}>
              {formatExportMode(option, locale)}
            </option>
          ))}
        </select>
      </label>

      <label className="control-field">
        <span>{t("export.destination", undefined, locale)}</span>
        <input
          disabled={disabled}
          onChange={(event) => onDestinationChange(event.target.value)}
          placeholder={t("export.destinationPlaceholder", undefined, locale)}
          type="text"
          value={destination}
        />
      </label>

      <p className="export-summary">
        {t(
          "export.summary",
          {
            count: exportCount,
            size: `${exportSizeMb.toFixed(1)} MB`,
          },
          locale,
        )}
      </p>

      <button
        className="primary-button compact"
        disabled={disabled || !destination.trim()}
        onClick={onExport}
        type="button"
      >
        {t("export.action", undefined, locale)}
      </button>
    </section>
  );
}

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
    <section className={`shooting-review mt-8 space-y-3 ${disabled ? "disabled" : ""}`}>
      <p className="section-label">{t("review.shootingTitle", undefined, locale)}</p>
      <div className="review-metrics">
        <div>
          <dt>{t("review.metric.rated", undefined, locale)}</dt>
          <dd>{review.rated}</dd>
        </div>
        <div>
          <dt>{t("review.metric.keepers", undefined, locale)}</dt>
          <dd>{review.keepers}</dd>
        </div>
        <div>
          <dt>{t("review.metric.keepRate", undefined, locale)}</dt>
          <dd>{Math.round(review.keepRate * 100)}%</dd>
        </div>
      </div>
      <p className="review-format-mix">
        {formatMix || t("review.noFormats", undefined, locale)}
      </p>
      <p className="review-summary-copy">
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

export function AppearanceControls({
  locale = defaultLocale,
  onThemeChange,
  theme,
}: {
  locale?: Locale;
  onThemeChange: (theme: ThemeMode) => void;
  theme: ThemeMode;
}) {
  const options: Array<{ label: string; value: ThemeMode }> = [
    { label: t("appearance.light", undefined, locale), value: "light" },
    { label: t("appearance.dark", undefined, locale), value: "dark" },
  ];

  return (
    <section className="settings-section">
      <p className="section-label">{t("appearance.title", undefined, locale)}</p>
      <div className="segmented-control mt-4">
        {options.map((option) => (
          <button
            aria-pressed={option.value === theme}
            className={option.value === theme ? "active" : ""}
            key={option.value}
            onClick={() => onThemeChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function EmptyPhotoDetails({ locale }: { locale: Locale }) {
  return (
    <section className="connection-help">
      <p className="section-label">{t("detail.emptyTitle", undefined, locale)}</p>
      <p className="mt-3 text-sm font-semibold leading-6">
        {t("connection.connectCamera", undefined, locale)}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {t("detail.emptyBody", undefined, locale)}
      </p>
    </section>
  );
}

function formatCatalogFilter(filter: PhotoCatalogFilter, locale: Locale) {
  const labels: Record<PhotoCatalogFilter, string> = {
    all: t("review.filter.all", undefined, locale),
    rated: t("review.filter.rated", undefined, locale),
    rating_3_plus: t("review.filter.rating3Plus", undefined, locale),
    rating_4_plus: t("review.filter.rating4Plus", undefined, locale),
    rating_5: t("review.filter.rating5", undefined, locale),
    unrated: t("review.filter.unrated", undefined, locale),
  };

  return labels[filter];
}

function formatCatalogSort(sort: PhotoCatalogSort, locale: Locale) {
  const labels: Record<PhotoCatalogSort, string> = {
    captured_asc: t("review.sort.capturedAsc", undefined, locale),
    filename_asc: t("review.sort.filenameAsc", undefined, locale),
    rating_desc: t("review.sort.ratingDesc", undefined, locale),
  };

  return labels[sort];
}

function formatExportMode(mode: ExportMode, locale: Locale) {
  const labels: Record<ExportMode, string> = {
    current: t("export.mode.current", undefined, locale),
    rating_3_plus: t("export.mode.rating3Plus", undefined, locale),
    rating_4_plus: t("export.mode.rating4Plus", undefined, locale),
    rating_5: t("export.mode.rating5", undefined, locale),
    visible: t("export.mode.visible", undefined, locale),
  };

  return labels[mode];
}

function formatExportStatus(status: ExportStatus, locale: Locale) {
  const labels: Record<ExportStatus, string> = {
    complete: t("export.status.complete", undefined, locale),
    error: t("export.status.error", undefined, locale),
    exporting: t("export.status.exporting", undefined, locale),
    idle: t("export.status.idle", undefined, locale),
  };

  return labels[status];
}

export function ConnectionDiagnosticDialog({
  diagnostics,
  locale = defaultLocale,
  onAction,
  onClose,
  onOpenImageCapture,
  onPrimaryAction,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onAction: (kind: DiagnosticActionKind) => void;
  onClose: () => void;
  onOpenImageCapture: () => void;
  onPrimaryAction: () => void;
}) {
  return (
    <div className="modal-overlay fixed inset-0 z-20 grid place-items-center px-5 py-6">
      <button
        aria-label={t("connection.closeCheck", undefined, locale)}
        className="modal-backdrop absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={t("connection.check", undefined, locale)}
        aria-modal="true"
        className="connection-dialog relative z-10 flex max-h-full w-[680px] max-w-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <p className="section-label">{t("connection.check", undefined, locale)}</p>
            <h2 className="mt-2 text-xl font-semibold">{diagnostics.summary}</h2>
          </div>
          <button
            aria-label={t("connection.closeCheck", undefined, locale)}
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ol className="diagnostic-steps">
            {diagnostics.steps.map((step) => (
              <DiagnosticStepRow
                key={step.id}
                locale={locale}
                onAction={onAction}
                step={step}
              />
            ))}
          </ol>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-line)] px-5 py-4">
          <button className="secondary-button" onClick={onOpenImageCapture} type="button">
            {t("connection.imageCapture", undefined, locale)}
          </button>
          <button
            className="primary-button"
            disabled={diagnostics.primaryAction.kind === "none"}
            onClick={onPrimaryAction}
            type="button"
          >
            {diagnostics.primaryAction.label}
          </button>
        </footer>
      </section>
    </div>
  );
}

function DiagnosticStepRow({
  locale = defaultLocale,
  onAction,
  step,
}: {
  locale?: Locale;
  onAction?: (kind: DiagnosticActionKind) => void;
  step: ConnectionDiagnosticStep;
}) {
  return (
    <li className={`diagnostic-step ${step.state}`}>
      <span aria-hidden="true" className="diagnostic-marker">
        {diagnosticSymbol(step.state)}
      </span>
      <span className="min-w-0">
        <span className="diagnostic-label-row">
          <span className="diagnostic-label">{step.label}</span>
          <span className="diagnostic-state">
            {formatDiagnosticState(step.state, locale)}
          </span>
        </span>
        <span className="diagnostic-detail">{step.detail}</span>
        {step.action && onAction ? (
          <button
            className="diagnostic-step-action"
            onClick={() => onAction(step.action?.kind ?? "none")}
            type="button"
          >
            {step.action.label}
          </button>
        ) : null}
      </span>
    </li>
  );
}

function diagnosticSymbol(state: ConnectionDiagnosticStep["state"]) {
  const symbols: Record<ConnectionDiagnosticStep["state"], string> = {
    attention: "!",
    checking: "...",
    complete: "✓",
    pending: "",
    unavailable: "−",
  };

  return symbols[state];
}

function formatDiagnosticState(
  state: ConnectionDiagnosticStep["state"],
  locale: Locale,
) {
  const labels: Record<ConnectionDiagnosticStep["state"], string> = {
    attention: t("diagnostic.state.attention", undefined, locale),
    checking: t("diagnostic.state.checking", undefined, locale),
    complete: t("diagnostic.state.complete", undefined, locale),
    pending: t("diagnostic.state.pending", undefined, locale),
    unavailable: t("diagnostic.state.unavailable", undefined, locale),
  };

  return labels[state];
}

function formatConnection(connection: CameraDevice["connection"], locale: Locale) {
  const labels: Record<CameraDevice["connection"], string> = {
    image_capture: t("format.imageCapture", undefined, locale),
    mock: t("format.mock", undefined, locale),
    nikon_sdk: t("format.nikonSdk", undefined, locale),
    usb: t("format.usb", undefined, locale),
  };

  return labels[connection];
}

function PhotoDetails({ locale, photo }: { locale: Locale; photo: CameraPhoto }) {
  const capturedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(photo.capturedAt));

  return (
    <dl className="details-list mt-5 space-y-4 text-sm">
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">{t("detail.captured", undefined, locale)}</dt>
        <dd className="mt-1 font-medium leading-6">{capturedAt}</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">{t("detail.format", undefined, locale)}</dt>
        <dd className="mt-1 font-medium uppercase">{photo.fileType}</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">{t("detail.resolution", undefined, locale)}</dt>
        <dd className="mt-1 font-medium">
          {photo.width} x {photo.height}
        </dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">{t("detail.size", undefined, locale)}</dt>
        <dd className="mt-1 font-medium">{photo.sizeMb.toFixed(1)} MB</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">{t("detail.writeBack", undefined, locale)}</dt>
        <dd className="mt-1 font-medium">{t("detail.writeBackAdapter", undefined, locale)}</dd>
      </div>
    </dl>
  );
}

function SettingsPanel({
  appInfo,
  autoUpdateEnabled,
  locale,
  onCheckForUpdate,
  onClose,
  onInstallUpdate,
  onLocaleChange,
  onThemeChange,
  onToggleAutoUpdate,
  theme,
  updateStatus,
}: {
  appInfo: AppInfo | null;
  autoUpdateEnabled: boolean;
  locale: Locale;
  onCheckForUpdate: () => void;
  onClose: () => void;
  onInstallUpdate: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeMode) => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  theme: ThemeMode;
  updateStatus: UpdateStatus;
}) {
  const changelog = appInfo?.changelog ?? t("settings.loadingLog", undefined, locale);
  const canInstall = updateStatus.state === "available";

  return (
    <div className="settings-overlay fixed inset-0 z-20 grid place-items-center px-5 py-6">
      <button
        aria-label={t("settings.close", undefined, locale)}
        className="settings-backdrop absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={t("settings.settings", undefined, locale)}
        aria-modal="true"
        className="settings-panel relative z-10 flex max-h-full w-[760px] max-w-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <p className="section-label">{t("settings.settings", undefined, locale)}</p>
            <h2 className="mt-2 text-xl font-semibold">{t("app.name", undefined, locale)}</h2>
          </div>
          <button
            aria-label={t("settings.close", undefined, locale)}
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="settings-section">
            <p className="section-label">{t("app.language", undefined, locale)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {locales.map((nextLocale) => (
                <button
                  className={[
                    "secondary-button compact",
                    nextLocale === locale ? "active" : "",
                  ].join(" ")}
                  key={nextLocale}
                  onClick={() => onLocaleChange(nextLocale)}
                  type="button"
                >
                  {t(
                    nextLocale === "zh-CN" ? "app.locale.zh" : "app.locale.en",
                    undefined,
                    locale,
                  )}
                </button>
              ))}
            </div>
          </section>

          <AppearanceControls
            locale={locale}
            onThemeChange={onThemeChange}
            theme={theme}
          />

          <section className="settings-section">
            <p className="section-label">{t("settings.version", undefined, locale)}</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="settings-row">
                <dt>{t("settings.name", undefined, locale)}</dt>
                <dd>{appInfo?.name ?? t("app.name", undefined, locale)}</dd>
              </div>
              <div className="settings-row">
                <dt>{t("settings.version", undefined, locale)}</dt>
                <dd>{appInfo?.version ?? t("settings.loading", undefined, locale)}</dd>
              </div>
              <div className="settings-row">
                <dt>{t("settings.updateFeed", undefined, locale)}</dt>
                <dd>{appInfo?.updateEndpoint ?? t("settings.loading", undefined, locale)}</dd>
              </div>
            </dl>
          </section>

          <section className="settings-section">
            <div className="flex items-center justify-between gap-4">
              <p className="section-label">{t("settings.updates", undefined, locale)}</p>
              <label className="toggle-row">
                <input
                  checked={autoUpdateEnabled}
                  onChange={(event) => onToggleAutoUpdate(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>{t("settings.autoCheck", undefined, locale)}</span>
              </label>
            </div>
            <p className={`update-message ${updateStatus.state}`}>
              {updateStatus.message}
            </p>
            {updateStatus.state === "available" ? (
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {t(
                  "settings.currentAvailable",
                  {
                    current: updateStatus.update.currentVersion,
                    available: updateStatus.update.version,
                  },
                  locale,
                )}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                className="secondary-button"
                disabled={updateStatus.state === "checking" || updateStatus.state === "installing"}
                onClick={onCheckForUpdate}
                type="button"
              >
                {t("settings.checkNow", undefined, locale)}
              </button>
              <button
                className="primary-button"
                disabled={!canInstall}
                onClick={onInstallUpdate}
                type="button"
              >
                {t("settings.install", undefined, locale)}
              </button>
            </div>
          </section>

          <section className="settings-section">
            <p className="section-label">{t("settings.developmentLog", undefined, locale)}</p>
            <pre className="changelog-view mt-4">{changelog}</pre>
          </section>
        </div>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default App;
