import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  createPhotoCatalog,
  getSelectedPhoto,
  selectPhoto,
  selectPhotoByOffset,
  selectPhotoEdge,
  updatePhotoRating,
} from "./features/photos/catalog";
import {
  getPhotoReviewShortcut,
  shouldIgnorePhotoReviewShortcut,
} from "./features/photos/keyboard";
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
  formatZoomLabel,
  type PhotoZoomState,
} from "./features/photos/zoom";
import {
  checkForUpdate,
  getAppInfo,
  installPendingUpdate,
  type AppInfo,
  type AvailableUpdate,
} from "./lib/appApi";
import { listCameras, listPhotos, setPhotoRating } from "./lib/cameraApi";
import "./index.css";

type UpdateStatus =
  | { state: "idle"; message: string }
  | { state: "checking"; message: string }
  | { state: "available"; message: string; update: AvailableUpdate }
  | { state: "installing"; message: string }
  | { state: "error"; message: string };

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
  const [status, setStatus] = useState("Looking for Nikon cameras...");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<PhotoZoomState>(() => createFitZoomState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(true);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    state: "idle",
    message: "Updates have not been checked in this session.",
  });

  useEffect(() => {
    async function loadCamera() {
      try {
        setConnectionState("loading");
        const nextCameras = await listCameras();

        if (nextCameras.length === 0) {
          setConnectionState("not_connected");
          setStatus("Connect the Z6III by USB to browse the card.");
          return;
        }

        const nextCamera = nextCameras[0];
        const nextPhotos = await listPhotos(nextCamera.id);
        setActiveCamera(nextCamera);
        setCatalog(createPhotoCatalog(nextPhotos));
        setConnectionState("connected");
        setStatus(`${nextCamera.name} mounted with ${nextPhotos.length} photos.`);
      } catch (error) {
        setConnectionState("error");
        setStatus(error instanceof Error ? error.message : "Camera scan failed.");
      }
    }

    void loadCamera();
  }, []);

  const selectedPhoto = useMemo(() => getSelectedPhoto(catalog), [catalog]);
  const selectedIndex = selectedPhoto
    ? catalog.photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1
    : 0;
  const ratedCount = catalog.photos.filter((photo) => photo.rating > 0).length;
  const connectionLabel =
    connectionState === "connected"
      ? "Ready"
      : connectionState === "loading"
        ? "Scanning"
        : connectionState === "error"
          ? "Needs attention"
          : "No camera";
  const zoomLabel = formatZoomLabel(zoom);

  useEffect(() => {
    void getAppInfo().then(setAppInfo).catch((error) => {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Could not read app info.",
      });
    });
  }, []);

  const handleCheckForUpdate = useCallback(async () => {
    setUpdateStatus({ state: "checking", message: "Checking GitHub Releases..." });

    try {
      const update = await checkForUpdate();

      if (!update) {
        setUpdateStatus({
          state: "idle",
          message: "No update is available for this version.",
        });
        return;
      }

      setUpdateStatus({
        state: "available",
        message: `Version ${update.version} is available.`,
        update,
      });
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Update check failed.",
      });
    }
  }, []);

  useEffect(() => {
    if (!autoUpdateEnabled || !appInfo) {
      return;
    }

    void Promise.resolve().then(handleCheckForUpdate);
  }, [appInfo, autoUpdateEnabled, handleCheckForUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    setUpdateStatus({ state: "installing", message: "Downloading update..." });

    try {
      await installPendingUpdate((event) => {
        if (event.event === "Started") {
          setUpdateStatus({
            state: "installing",
            message: event.data.contentLength
              ? `Downloading ${formatBytes(event.data.contentLength)}...`
              : "Downloading update...",
          });
          return;
        }

        if (event.event === "Finished") {
          setUpdateStatus({
            state: "installing",
            message: "Installing update and relaunching...",
          });
        }
      });
    } catch (error) {
      setUpdateStatus({
        state: "error",
        message:
          error instanceof Error ? error.message : "Update installation failed.",
      });
    }
  }, []);

  const handleRatingChange = useCallback(async (photo: CameraPhoto, rating: Rating) => {
    setRatingError(null);
    setCatalog((current) => updatePhotoRating(current, photo.id, rating));

    try {
      await setPhotoRating(photo.id, rating);
      setStatus(`Saved ${rating} star${rating === 1 ? "" : "s"} to ${photo.fileName}.`);
    } catch (error) {
      setCatalog((current) => updatePhotoRating(current, photo.id, photo.rating));
      setRatingError(
        error instanceof Error
          ? error.message
          : "Rating write-back failed. The camera may not support this operation.",
      );
    }
  }, []);

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
        setCatalog((current) => selectPhotoByOffset(current, shortcut.offset));
        return;
      }

      if (shortcut.type === "edge") {
        event.preventDefault();
        setZoom(createFitZoomState());
        setCatalog((current) => selectPhotoEdge(current, shortcut.edge));
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
  }, [connectionState, handleRatingChange, selectedPhoto]);

  return (
    <main className="app-shell h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="app-frame grid h-full min-h-0 grid-cols-[248px_minmax(0,1fr)]">
        <aside className="side-panel min-h-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-panel)] px-5 py-5">
          <div className="brand-row flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                Nikon Connector
              </p>
              <h1 className="mt-2 text-[1.45rem] font-semibold leading-tight tracking-normal text-[var(--color-ink)]">
                Camera Card
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
            <p className="section-label">Device</p>
            {activeCamera ? (
              <div className="device-card rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
                <p
                  className="device-name text-base font-semibold leading-snug"
                  title={activeCamera.name}
                >
                  {activeCamera.name}
                </p>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">
                  {formatConnection(activeCamera.connection)}
                </p>
              </div>
            ) : (
              <div className="empty-device rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm leading-6 text-[var(--color-muted)]">
                {status}
              </div>
            )}
          </section>

          <section className="mt-8 space-y-3">
            <p className="section-label">Library</p>
            <dl className="library-stats grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-[var(--color-surface)] px-3 py-3">
                <dt className="text-[var(--color-muted)]">Photos</dt>
                <dd className="mt-1.5 text-2xl font-semibold leading-none">
                  {catalog.photos.length}
                </dd>
              </div>
              <div className="rounded-md bg-[var(--color-surface)] px-3 py-3">
                <dt className="text-[var(--color-muted)]">Rated</dt>
                <dd className="mt-1.5 text-2xl font-semibold leading-none">{ratedCount}</dd>
              </div>
            </dl>
          </section>

          <button
            className="settings-entry mt-8 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3 text-left text-sm font-semibold text-[var(--color-ink)] transition hover:bg-[var(--color-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            ⚙ Settings
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
                title={selectedPhoto?.fileName ?? "No photo selected"}
              >
                {selectedPhoto?.fileName ?? "No photo selected"}
              </h2>
            </div>
            <div className="top-actions flex shrink-0 items-center gap-4">
              {selectedPhoto ? (
                <span className="photo-count whitespace-nowrap text-sm font-medium text-[var(--color-muted)]">
                  {selectedIndex} / {catalog.photos.length}
                </span>
              ) : null}
              {selectedPhoto ? (
                <StarRating
                  disabled={connectionState !== "connected"}
                  onChange={(rating) => void handleRatingChange(selectedPhoto, rating)}
                  value={selectedPhoto.rating}
                />
              ) : null}
            </div>
          </header>

          <div className="review-area grid min-h-0 grid-cols-[minmax(0,1fr)_232px]">
            <figure className="photo-stage relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-[var(--color-stage)] p-6">
              {selectedPhoto ? (
                <>
                  <div className="zoom-toolbar absolute left-5 top-5 z-10 flex items-center gap-1.5 rounded-lg border border-[var(--color-stage-line)] bg-[var(--color-stage-toolbar)] p-1 text-[var(--color-on-image)]">
                    <button
                      aria-label="Zoom out"
                      className="zoom-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "out"))}
                      title="Zoom out (-)"
                      type="button"
                    >
                      −
                    </button>
                    <span className="zoom-readout">{zoomLabel}</span>
                    <button
                      aria-label="Zoom in"
                      className="zoom-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "in"))}
                      title="Zoom in (+)"
                      type="button"
                    >
                      +
                    </button>
                    <button
                      className="zoom-text-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "fit"))}
                      title="Fit to window (F)"
                      type="button"
                    >
                      Fit
                    </button>
                    <button
                      className="zoom-text-button"
                      onClick={() => setZoom((current) => applyZoomAction(current, "actual"))}
                      title="Actual size (Z)"
                      type="button"
                    >
                      100%
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
                      Preview unavailable for this camera item.
                    </div>
                  )}
                </>
              ) : (
                <div className="max-w-sm text-center text-[var(--color-stage-muted)]">
                  Connect a Nikon Z6III to start browsing the card.
                </div>
              )}
            </figure>

            <aside className="details-panel min-h-0 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <h3 className="section-label">
                Details
              </h3>
              {selectedPhoto ? <PhotoDetails photo={selectedPhoto} /> : null}
              {ratingError ? (
                <p className="mt-6 rounded-lg border border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] p-3 text-sm leading-6 text-[var(--color-danger)]">
                  {ratingError}
                </p>
              ) : null}
            </aside>
          </div>

          <nav className="filmstrip min-w-0 overflow-x-auto border-t border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
            <div className="flex min-w-max gap-3">
              {catalog.photos.map((photo) => {
                const isSelected = photo.id === catalog.selectedPhotoId;

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
                      <span className="shrink-0">{photo.rating ? `${photo.rating}★` : "Unrated"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </section>
      </div>
      {settingsOpen ? (
        <SettingsPanel
          appInfo={appInfo}
          autoUpdateEnabled={autoUpdateEnabled}
          onCheckForUpdate={() => void handleCheckForUpdate()}
          onClose={() => setSettingsOpen(false)}
          onInstallUpdate={() => void handleInstallUpdate()}
          onToggleAutoUpdate={setAutoUpdateEnabled}
          updateStatus={updateStatus}
        />
      ) : null}
    </main>
  );
}

function formatConnection(connection: CameraDevice["connection"]) {
  const labels: Record<CameraDevice["connection"], string> = {
    image_capture: "USB connected",
    mock: "Preview data",
    nikon_sdk: "Nikon SDK connected",
    usb: "USB connected",
  };

  return labels[connection];
}

function PhotoDetails({ photo }: { photo: CameraPhoto }) {
  const capturedAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(photo.capturedAt));

  return (
    <dl className="details-list mt-5 space-y-4 text-sm">
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">Captured</dt>
        <dd className="mt-1 font-medium leading-6">{capturedAt}</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">Format</dt>
        <dd className="mt-1 font-medium uppercase">{photo.fileType}</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">Resolution</dt>
        <dd className="mt-1 font-medium">
          {photo.width} x {photo.height}
        </dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">Size</dt>
        <dd className="mt-1 font-medium">{photo.sizeMb.toFixed(1)} MB</dd>
      </div>
      <div className="detail-row">
        <dt className="text-[var(--color-muted)]">Write-back</dt>
        <dd className="mt-1 font-medium">Nikon SDK adapter</dd>
      </div>
    </dl>
  );
}

function SettingsPanel({
  appInfo,
  autoUpdateEnabled,
  onCheckForUpdate,
  onClose,
  onInstallUpdate,
  onToggleAutoUpdate,
  updateStatus,
}: {
  appInfo: AppInfo | null;
  autoUpdateEnabled: boolean;
  onCheckForUpdate: () => void;
  onClose: () => void;
  onInstallUpdate: () => void;
  onToggleAutoUpdate: (enabled: boolean) => void;
  updateStatus: UpdateStatus;
}) {
  const changelog = appInfo?.changelog ?? "Loading development log...";
  const canInstall = updateStatus.state === "available";

  return (
    <div className="settings-overlay fixed inset-0 z-20 grid place-items-center px-5 py-6">
      <button
        aria-label="Close settings"
        className="settings-backdrop absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label="Settings"
        aria-modal="true"
        className="settings-panel relative z-10 flex max-h-full w-[760px] max-w-full flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)]"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
          <div>
            <p className="section-label">Settings</p>
            <h2 className="mt-2 text-xl font-semibold">Nikon Connector</h2>
          </div>
          <button
            aria-label="Close settings"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section className="settings-section">
            <p className="section-label">Version</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="settings-row">
                <dt>Name</dt>
                <dd>{appInfo?.name ?? "Nikon Connector"}</dd>
              </div>
              <div className="settings-row">
                <dt>Version</dt>
                <dd>{appInfo?.version ?? "Loading..."}</dd>
              </div>
              <div className="settings-row">
                <dt>Update feed</dt>
                <dd>{appInfo?.updateEndpoint ?? "Loading..."}</dd>
              </div>
            </dl>
          </section>

          <section className="settings-section">
            <div className="flex items-center justify-between gap-4">
              <p className="section-label">Updates</p>
              <label className="toggle-row">
                <input
                  checked={autoUpdateEnabled}
                  onChange={(event) => onToggleAutoUpdate(event.currentTarget.checked)}
                  type="checkbox"
                />
                <span>Auto-check</span>
              </label>
            </div>
            <p className={`update-message ${updateStatus.state}`}>
              {updateStatus.message}
            </p>
            {updateStatus.state === "available" ? (
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                Current {updateStatus.update.currentVersion}, available{" "}
                {updateStatus.update.version}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                className="secondary-button"
                disabled={updateStatus.state === "checking" || updateStatus.state === "installing"}
                onClick={onCheckForUpdate}
                type="button"
              >
                Check now
              </button>
              <button
                className="primary-button"
                disabled={!canInstall}
                onClick={onInstallUpdate}
                type="button"
              >
                Install
              </button>
            </div>
          </section>

          <section className="settings-section">
            <p className="section-label">Development Log</p>
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
