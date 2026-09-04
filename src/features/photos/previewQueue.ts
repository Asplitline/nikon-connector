import type { CameraPhoto } from "./types";

export interface PreviewQueueOptions {
  photos: CameraPhoto[];
  selectedPhotoId: string | null;
  inFlightPhotoIds: Set<string>;
  radius?: number;
}

export function createPreviewQueue({
  photos,
  selectedPhotoId,
  inFlightPhotoIds,
  radius = 2,
}: PreviewQueueOptions): CameraPhoto[] {
  if (!selectedPhotoId) {
    return [];
  }

  const selectedIndex = photos.findIndex((photo) => photo.id === selectedPhotoId);
  if (selectedIndex === -1) {
    return [];
  }

  const indexes = [selectedIndex];
  for (let distance = 1; distance <= radius; distance += 1) {
    indexes.push(selectedIndex - distance, selectedIndex + distance);
  }

  return indexes
    .filter((index) => index >= 0 && index < photos.length)
    .map((index) => photos[index])
    .filter((photo) => needsPreview(photo, inFlightPhotoIds));
}

function needsPreview(photo: CameraPhoto, inFlightPhotoIds: Set<string>) {
  return !photo.previewUrl && !photo.thumbnailUrl && !inFlightPhotoIds.has(photo.id);
}
