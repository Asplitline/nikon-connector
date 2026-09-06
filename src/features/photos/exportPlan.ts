import type { CameraPhoto } from "./types";

export type ExportMode =
  | "visible"
  | "picked"
  | "rating_3_plus"
  | "rating_4_plus"
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

  if (input.mode === "rating_3_plus") {
    return input.photos.filter((photo) => photo.rating >= 3);
  }

  if (input.mode === "rating_4_plus") {
    return input.photos.filter((photo) => photo.rating >= 4);
  }

  if (input.mode === "rating_5") {
    return input.photos.filter((photo) => photo.rating === 5);
  }

  if (input.mode === "picked") {
    return input.photos.filter((photo) => photo.pickStatus === "picked");
  }

  return input.visiblePhotos;
}
