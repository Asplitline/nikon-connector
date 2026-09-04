import type { CameraPhoto } from "./types";

// 渐进式照片投递的纯合并逻辑：后端分批推送，前端边收边渲染，
// 首屏不必等整卡枚举完成。放在纯模块里以便在 node 环境完整单测。

export interface PhotoStreamState {
  // 已收到的照片，按到达顺序累积
  photos: CameraPhoto[];
  // 后端是否已声明本次枚举结束
  done: boolean;
  // 枚举过程中的错误（有错也保留已收到的部分）
  error: string | null;
}

export interface PhotoBatch {
  photos: CameraPhoto[];
  // 后端标记这是最后一批
  done?: boolean;
}

export function createPhotoStream(): PhotoStreamState {
  return { done: false, error: null, photos: [] };
}

// 合并一批新照片。同 id 以新数据为准（后端可能先给元数据后补预览），
// 但不会用空值覆盖已有的预览地址。
export function mergePhotoBatch(
  state: PhotoStreamState,
  batch: PhotoBatch,
): PhotoStreamState {
  if (batch.photos.length === 0) {
    return batch.done && !state.done ? { ...state, done: true } : state;
  }

  const indexById = new Map(state.photos.map((photo, index) => [photo.id, index]));
  const photos = state.photos.slice();

  for (const incoming of batch.photos) {
    const existing = indexById.get(incoming.id);
    if (existing === undefined) {
      indexById.set(incoming.id, photos.length);
      photos.push(incoming);
      continue;
    }

    photos[existing] = mergePhoto(photos[existing], incoming);
  }

  return {
    done: batch.done ?? state.done,
    error: state.error,
    photos,
  };
}

export function markPhotoStreamFailed(
  state: PhotoStreamState,
  error: string,
): PhotoStreamState {
  return { ...state, done: true, error };
}

// 空字符串代表「这一档还没缓存」，不能覆盖已有地址；
// 与 catalog.updatePhotoPreview 的 || 回退语义保持一致
function mergePhoto(current: CameraPhoto, incoming: CameraPhoto): CameraPhoto {
  return {
    ...current,
    ...incoming,
    previewUrl: incoming.previewUrl || current.previewUrl,
    thumbnailUrl: incoming.thumbnailUrl || current.thumbnailUrl,
  };
}
