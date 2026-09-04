import type { CameraPhoto, PhotoCatalogState, Rating } from "./types";

export type PhotoCatalogFilter =
  | "all"
  | "unrated"
  | "rated"
  | "rating_3_plus"
  | "rating_4_plus"
  | "rating_5";

export type PhotoCatalogSort = "captured_asc" | "filename_asc" | "rating_desc";

export interface PhotoCatalogViewOptions {
  filter: PhotoCatalogFilter;
  sort: PhotoCatalogSort;
}

export function createPhotoCatalog(photos: CameraPhoto[]): PhotoCatalogState {
  return {
    photos,
    selectedPhotoId: firstPreviewablePhoto(photos)?.id ?? photos[0]?.id ?? null,
  };
}

export function selectPhoto(
  state: PhotoCatalogState,
  photoId: string,
): PhotoCatalogState {
  if (!state.photos.some((photo) => photo.id === photoId)) {
    return state;
  }

  return {
    ...state,
    selectedPhotoId: photoId,
  };
}

export function selectPhotoByOffset(
  state: PhotoCatalogState,
  offset: number,
): PhotoCatalogState {
  if (state.photos.length === 0) {
    return state;
  }

  const currentIndex = Math.max(
    0,
    state.photos.findIndex((photo) => photo.id === state.selectedPhotoId),
  );
  const nextIndex = clampIndex(currentIndex + offset, state.photos.length);

  return {
    ...state,
    selectedPhotoId: state.photos[nextIndex].id,
  };
}

export function selectPhotoEdge(
  state: PhotoCatalogState,
  edge: "first" | "last",
): PhotoCatalogState {
  if (state.photos.length === 0) {
    return state;
  }

  const nextIndex = edge === "first" ? 0 : state.photos.length - 1;

  return {
    ...state,
    selectedPhotoId: state.photos[nextIndex].id,
  };
}

export function updatePhotoRating(
  state: PhotoCatalogState,
  photoId: string,
  rating: Rating,
): PhotoCatalogState {
  return {
    ...state,
    photos: state.photos.map((photo) =>
      photo.id === photoId ? { ...photo, rating } : photo,
    ),
  };
}

export function updatePhotoPreview(
  state: PhotoCatalogState,
  preview: { photoId: string; previewUrl: string; thumbnailUrl: string },
): PhotoCatalogState {
  return {
    ...state,
    photos: state.photos.map((photo) =>
      photo.id === preview.photoId
        ? {
            ...photo,
            previewUrl: preview.previewUrl || photo.previewUrl,
            thumbnailUrl: preview.thumbnailUrl || photo.thumbnailUrl,
          }
        : photo,
    ),
  };
}

export function getSelectedPhoto(
  state: PhotoCatalogState,
): CameraPhoto | undefined {
  return state.photos.find((photo) => photo.id === state.selectedPhotoId);
}

export function getCatalogView(
  state: PhotoCatalogState,
  options: PhotoCatalogViewOptions,
): PhotoCatalogState {
  const photos = state.photos
    .filter((photo) => matchesFilter(photo, options.filter))
    .slice()
    .sort((left, right) => comparePhotos(left, right, options.sort));
  const selectedPhotoId = photos.some((photo) => photo.id === state.selectedPhotoId)
    ? state.selectedPhotoId
    : firstPreviewablePhoto(photos)?.id ?? photos[0]?.id ?? null;

  return {
    photos,
    selectedPhotoId,
  };
}

function firstPreviewablePhoto(photos: CameraPhoto[]) {
  return photos.find((photo) => photo.previewUrl || photo.thumbnailUrl);
}

function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1);
}

function matchesFilter(photo: CameraPhoto, filter: PhotoCatalogFilter) {
  switch (filter) {
    case "unrated":
      return photo.rating === 0;
    case "rated":
      return photo.rating > 0;
    case "rating_3_plus":
      return photo.rating >= 3;
    case "rating_4_plus":
      return photo.rating >= 4;
    case "rating_5":
      return photo.rating === 5;
    case "all":
      return true;
  }
}

function comparePhotos(
  left: CameraPhoto,
  right: CameraPhoto,
  sort: PhotoCatalogSort,
) {
  switch (sort) {
    case "filename_asc":
      return left.fileName.localeCompare(right.fileName);
    case "rating_desc":
      return right.rating - left.rating || left.fileName.localeCompare(right.fileName);
    case "captured_asc":
      return (
        Date.parse(left.capturedAt) - Date.parse(right.capturedAt) ||
        left.fileName.localeCompare(right.fileName)
      );
  }
}
