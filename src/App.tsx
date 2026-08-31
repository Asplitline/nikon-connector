import { useEffect, useMemo, useState } from "react";
import {
  createPhotoCatalog,
  getSelectedPhoto,
  selectPhoto,
  updatePhotoRating,
} from "./features/photos/catalog";
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

  async function handleRatingChange(photo: CameraPhoto, rating: Rating) {
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
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--color-canvas)] text-[var(--color-ink)]">
      <div className="grid h-full min-h-0 grid-cols-[236px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                Nikon Connector
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-normal text-[var(--color-ink)]">
                Camera Card
              </h1>
            </div>
            <span
              className={[
                "mt-1 h-2.5 w-2.5 rounded-full",
                connectionState === "connected"
                  ? "bg-[var(--color-ready)]"
                  : "bg-[var(--color-muted)]",
              ].join(" ")}
            />
          </div>

          <section className="mt-6 space-y-3">
            <p className="text-sm font-medium text-[var(--color-muted)]">Device</p>
            {activeCamera ? (
              <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                <p className="text-base font-semibold">{activeCamera.name}</p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {activeCamera.connection === "mock"
                    ? "Preview data"
                    : "USB connected"}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                {status}
              </div>
            )}
          </section>

          <section className="mt-6 space-y-3">
            <p className="text-sm font-medium text-[var(--color-muted)]">Library</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Photos</dt>
                <dd className="mt-1 text-xl font-semibold">{catalog.photos.length}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Rated</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {catalog.photos.filter((photo) => photo.rating > 0).length}
                </dd>
              </div>
            </dl>
          </section>
        </aside>

        <section className="grid h-full min-h-0 grid-rows-[72px_minmax(0,1fr)_148px]">
          <header className="flex min-h-0 items-center justify-between gap-4 border-b border-[var(--color-line)] px-5 py-3">
            <div>
              <p className="text-sm text-[var(--color-muted)]">{status}</p>
              <h2 className="mt-1 text-xl font-semibold">
                {selectedPhoto?.fileName ?? "No photo selected"}
              </h2>
            </div>
            {selectedPhoto ? (
              <StarRating
                disabled={connectionState !== "connected"}
                onChange={(rating) => void handleRatingChange(selectedPhoto, rating)}
                value={selectedPhoto.rating}
              />
            ) : null}
          </header>

          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_220px]">
            <figure className="flex min-h-0 overflow-hidden items-center justify-center bg-[var(--color-stage)] p-5">
              {selectedPhoto ? (
                <img
                  alt={selectedPhoto.fileName}
                  className="max-h-full max-w-full rounded-md object-contain shadow-[0_20px_80px_color-mix(in_oklch,var(--color-ink)_18%,transparent)]"
                  src={selectedPhoto.previewUrl}
                />
              ) : (
                <div className="max-w-sm text-center text-[var(--color-muted)]">
                  Connect a Nikon Z6III to start browsing the card.
                </div>
              )}
            </figure>

            <aside className="min-h-0 overflow-y-auto border-l border-[var(--color-line)] bg-[var(--color-panel)] p-4">
              <h3 className="text-sm font-semibold text-[var(--color-muted)]">
                Details
              </h3>
              {selectedPhoto ? <PhotoDetails photo={selectedPhoto} /> : null}
              {ratingError ? (
                <p className="mt-6 rounded-lg border border-[var(--color-danger-line)] bg-[var(--color-danger-bg)] p-3 text-sm text-[var(--color-danger)]">
                  {ratingError}
                </p>
              ) : null}
            </aside>
          </div>

          <nav className="min-w-0 overflow-x-auto border-t border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-3">
            <div className="flex min-w-max gap-2.5">
              {catalog.photos.map((photo) => {
                const isSelected = photo.id === catalog.selectedPhotoId;

                return (
                  <button
                    className={[
                      "group relative h-[112px] w-[142px] overflow-hidden rounded-lg border bg-[var(--color-surface)] text-left transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]",
                      isSelected
                        ? "border-[var(--color-ink)]"
                        : "border-[var(--color-line)] hover:border-[var(--color-muted)]",
                    ].join(" ")}
                    key={photo.id}
                    onClick={() =>
                      setCatalog((current) => selectPhoto(current, photo.id))
                    }
                    type="button"
                  >
                    <img
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      src={photo.thumbnailUrl}
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(to_top,color-mix(in_oklch,var(--color-ink)_70%,transparent),transparent)] px-3 pb-2 pt-8 text-xs font-medium text-[var(--color-on-image)]">
                      <span>{photo.fileName}</span>
                      <span>{photo.rating ? `${photo.rating}★` : "Unrated"}</span>
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

function PhotoDetails({ photo }: { photo: CameraPhoto }) {
  const capturedAt = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(photo.capturedAt));

  return (
    <dl className="mt-5 space-y-4 text-sm">
      <div>
        <dt className="text-[var(--color-muted)]">Captured</dt>
        <dd className="mt-1 font-medium">{capturedAt}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted)]">Format</dt>
        <dd className="mt-1 font-medium uppercase">{photo.fileType}</dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted)]">Resolution</dt>
        <dd className="mt-1 font-medium">
          {photo.width} x {photo.height}
        </dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted)]">Size</dt>
        <dd className="mt-1 font-medium">{photo.sizeMb.toFixed(1)} MB</dd>
      </div>
      <div>
        <dt className="text-[var(--color-muted)]">Write-back</dt>
        <dd className="mt-1 font-medium">Nikon SDK adapter</dd>
      </div>
    </dl>
  );
}

export default App;
