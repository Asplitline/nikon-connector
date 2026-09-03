import type { CameraPhoto } from "./types";

export interface ShootingReview {
  firstCapturedAt: string | null;
  formats: Record<string, number>;
  keepRate: number;
  keepers: number;
  lastCapturedAt: string | null;
  rated: number;
  total: number;
  unrated: number;
}

export function createShootingReview(photos: CameraPhoto[]): ShootingReview {
  const total = photos.length;
  const rated = photos.filter((photo) => photo.rating > 0).length;
  const keepers = photos.filter((photo) => photo.rating >= 4).length;
  const capturedAt = photos
    .map((photo) => photo.capturedAt)
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort();

  return {
    firstCapturedAt: capturedAt[0] ?? null,
    formats: countFormats(photos),
    keepRate: total === 0 ? 0 : keepers / total,
    keepers,
    lastCapturedAt: capturedAt[capturedAt.length - 1] ?? null,
    rated,
    total,
    unrated: total - rated,
  };
}

function countFormats(photos: CameraPhoto[]) {
  return photos.reduce<Record<string, number>>((formats, photo) => {
    formats[photo.fileType] = (formats[photo.fileType] ?? 0) + 1;
    return formats;
  }, {});
}
