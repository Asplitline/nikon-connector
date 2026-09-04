import type { CameraPhoto } from "./types";

// 档位：网格只需要缩略图，loupe 需要大图。选中项要能从「只有缩略图」升到大图，
// 否则渐进式细化（先出低档再换高档）无从实现。
export type PreviewTier = "thumbnail" | "preview";

export interface PreviewQueueItem {
  photo: CameraPhoto;
  tier: PreviewTier;
}

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
  return createPreviewPlan({ photos, selectedPhotoId, inFlightPhotoIds, radius }).map(
    (item) => item.photo,
  );
}

// 带档位的排队计划：选中项要 preview 档，邻居只要 thumbnail 档
export function createPreviewPlan({
  photos,
  selectedPhotoId,
  inFlightPhotoIds,
  radius = 2,
}: PreviewQueueOptions): PreviewQueueItem[] {
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
    .map((index) => ({
      photo: photos[index],
      tier: index === selectedIndex ? ("preview" as const) : ("thumbnail" as const),
    }))
    .filter((item) => needsTier(item.photo, item.tier, inFlightPhotoIds));
}

// 某张照片在给定档位上是否还需要请求
export function needsTier(
  photo: CameraPhoto,
  tier: PreviewTier,
  inFlightPhotoIds: Set<string>,
) {
  if (inFlightPhotoIds.has(photo.id)) {
    return false;
  }

  if (tier === "preview") {
    return !photo.previewUrl;
  }

  // 缩略图档位：已有任一档位的图就够网格用了
  return !photo.thumbnailUrl && !photo.previewUrl;
}
