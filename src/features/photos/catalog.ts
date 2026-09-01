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

export function getSelectedPhoto(
  state: PhotoCatalogState,
): CameraPhoto | undefined {
  return state.photos.find((photo) => photo.id === state.selectedPhotoId);
}

function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1);
}
