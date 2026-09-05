import type { CameraPhoto } from "./types";

// 档位：网格只需要缩略图，loupe 需要大图。选中项要能从「只有缩略图」升到大图，
// 否则渐进式细化（先出低档再换高档）无从实现。
export type PreviewTier = "thumbnail" | "preview";

export interface PreviewQueueItem {
  photo: CameraPhoto;
  tier: PreviewTier;
}

export interface PreviewRequestBatch {
  items: PreviewQueueItem[];
  previewPhotoIds: string[];
}

export interface PreviewQueueOptions {
  photos: CameraPhoto[];
  selectedPhotoId: string | null;
  inFlightPhotoIds: Set<string>;
  previewLookahead?: number;
  radius?: number;
}

export function createPreviewQueue({
  photos,
  selectedPhotoId,
  inFlightPhotoIds,
  previewLookahead,
  radius = 2,
}: PreviewQueueOptions): CameraPhoto[] {
  return createPreviewPlan({
    photos,
    selectedPhotoId,
    inFlightPhotoIds,
    previewLookahead,
    radius,
  }).map((item) => item.photo);
}

// 带档位的排队计划：选中项要 preview 档，邻居只要 thumbnail 档
export function createPreviewPlan({
  photos,
  selectedPhotoId,
  inFlightPhotoIds,
  previewLookahead = 0,
  radius = 2,
}: PreviewQueueOptions): PreviewQueueItem[] {
  if (!selectedPhotoId) {
    return [];
  }

  const selectedIndex = photos.findIndex((photo) => photo.id === selectedPhotoId);
  if (selectedIndex === -1) {
    return [];
  }

  const plan: PreviewQueueItem[] = [];
  const plannedKeys = new Set<string>();
  const plannedPreviewPhotoIds = new Set<string>();

  function add(index: number, tier: PreviewTier) {
    if (index < 0 || index >= photos.length) {
      return;
    }

    const photo = photos[index];
    if (tier === "thumbnail" && plannedPreviewPhotoIds.has(photo.id)) {
      return;
    }

    const key = previewRequestKey(photo.id, tier);
    if (plannedKeys.has(key)) {
      return;
    }

    const item = { photo, tier };
    if (!needsTier(photo, tier, inFlightPhotoIds)) {
      return;
    }

    plan.push(item);
    plannedKeys.add(key);
    if (tier === "preview") {
      plannedPreviewPhotoIds.add(photo.id);
    }
  }

  add(selectedIndex, "preview");

  for (let offset = 1; offset <= previewLookahead; offset += 1) {
    add(selectedIndex + offset, "preview");
  }

  for (let distance = 1; distance <= radius; distance += 1) {
    add(selectedIndex - distance, "thumbnail");
    add(selectedIndex + distance, "thumbnail");
  }

  return plan;
}

// 某张照片在给定档位上是否还需要请求
export function needsTier(
  photo: CameraPhoto,
  tier: PreviewTier,
  inFlightPhotoIds: Set<string>,
) {
  if (inFlightPhotoIds.has(photo.id) || inFlightPhotoIds.has(previewRequestKey(photo.id, tier))) {
    return false;
  }

  if (tier === "preview") {
    return !photo.previewUrl;
  }

  // 缩略图档位：已有任一档位的图就够网格用了
  return !photo.thumbnailUrl && !photo.previewUrl;
}

export function previewRequestKey(photoId: string, tier: PreviewTier) {
  return `${photoId}:${tier}`;
}

export function createPreviewRequestBatches(
  plan: PreviewQueueItem[],
  selectedPhotoId: string,
): PreviewRequestBatch[] {
  const selectedPreview = plan.find(
    (item) => item.photo.id === selectedPhotoId && item.tier === "preview",
  );
  const remaining = plan.filter((item) => item !== selectedPreview);
  const batches: PreviewRequestBatch[] = [];

  if (selectedPreview) {
    batches.push({
      items: [selectedPreview],
      previewPhotoIds: [selectedPreview.photo.id],
    });
  }

  if (remaining.length > 0) {
    batches.push({
      items: remaining,
      previewPhotoIds: remaining
        .filter((item) => item.tier === "preview")
        .map((item) => item.photo.id),
    });
  }

  return batches;
}
