import { useCallback, useEffect, useMemo, useState } from "react";
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
import { listCameras, listPhotos, setPhotoRating } from "./lib/cameraApi";
import "./index.css";

function App() {
  const [connectionState, setConnectionState] =
    useState<CameraConnectionState>("loading");
  const [activeCamera, setActiveCamera] = useState<CameraDevice | null>(null);
  const [catalog, setCatalog] = useState<PhotoCatalogState>(() =>
    createPhotoCatalog([]),
  );
  const [status, setStatus] = useState("Looking for Nikon cameras...");
  const [ratingError, setRatingError] = useState<string | null>(null);

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
        setCatalog((current) => selectPhotoByOffset(current, shortcut.offset));
        return;
      }

      if (shortcut.type === "edge") {
        event.preventDefault();
        setCatalog((current) => selectPhotoEdge(current, shortcut.edge));
        return;
      }

      if (connectionState === "connected" && selectedPhoto) {
        event.preventDefault();
        void handleRatingChange(selectedPhoto, shortcut.rating);
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
            <figure className="photo-stage flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-[var(--color-stage)] p-6">
              {selectedPhoto ? (
                <img
                  alt={selectedPhoto.fileName}
                  className="review-image max-h-full max-w-full rounded-md object-contain"
                  src={selectedPhoto.previewUrl}
                />
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
                    onClick={() =>
                      setCatalog((current) => selectPhoto(current, photo.id))
                    }
                    title={photo.fileName}
                    type="button"
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                      src={photo.thumbnailUrl}
                    />
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

export default App;
