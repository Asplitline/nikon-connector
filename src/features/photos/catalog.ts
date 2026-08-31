import type { CameraPhoto, PhotoCatalogState, Rating } from "./types";

export function createPhotoCatalog(photos: CameraPhoto[]): PhotoCatalogState {
  return {
    photos,
    selectedPhotoId: photos[0]?.id ?? null,
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

export function getSelectedPhoto(
  state: PhotoCatalogState,
): CameraPhoto | undefined {
  return state.photos.find((photo) => photo.id === state.selectedPhotoId);
}
