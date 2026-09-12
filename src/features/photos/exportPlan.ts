import type { CameraPhoto } from "./types";

export type ExportMode =
  | "picked"
  | "unrated"
  | "rating_1"
  | "rating_2"
  | "rating_3"
  | "rating_4"
  | "rating_5"
  | "current";

export interface ExportSelectionInput {
  mode: ExportMode;
  photos: CameraPhoto[];
  selectedPhotoId: string | null;
  visiblePhotos: CameraPhoto[];
}

export interface ExportSelection {
  count: number;
  photoIds: string[];
  sizeMb: number;
}

export function createExportSelection(
  input: ExportSelectionInput,
): ExportSelection {
  const selectedPhotos = selectPhotosForExport(input);
  const photoIds = selectedPhotos.map((photo) => photo.id);

  return {
    count: photoIds.length,
    photoIds,
    sizeMb: estimateExportSize(input.photos, photoIds),
  };
}

export function estimateExportSize(photos: CameraPhoto[], photoIds: string[]) {
  const selected = new Set(photoIds);
  return photos.reduce(
    (total, photo) => total + (selected.has(photo.id) ? photo.sizeMb : 0),
    0,
  );
}

function selectPhotosForExport(input: ExportSelectionInput) {
  if (input.mode === "current") {
    return input.photos.filter((photo) => photo.id === input.selectedPhotoId);
  }

  if (input.mode === "unrated") {
    return input.photos.filter((photo) => photo.rating === 0);
  }

  if (input.mode === "rating_1") {
    return input.photos.filter((photo) => photo.rating === 1);
  }

  if (input.mode === "rating_2") {
    return input.photos.filter((photo) => photo.rating === 2);
  }

  if (input.mode === "rating_3") {
    return input.photos.filter((photo) => photo.rating === 3);
  }

  if (input.mode === "rating_4") {
    return input.photos.filter((photo) => photo.rating === 4);
  }

  if (input.mode === "rating_5") {
    return input.photos.filter((photo) => photo.rating === 5);
  }

  if (input.mode === "picked") {
    return input.photos.filter((photo) => photo.pickStatus === "picked");
  }

  return [];
}
