import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CameraDevice, CameraPhoto, Rating } from "../features/photos/types";

const canUseTauri = () => "__TAURI_INTERNALS__" in window;

export interface ExportPhotosRequest {
  cameraId: string;
  destinationDir: string;
  photoIds: string[];
}

export interface ExportPhotosSummary {
  copied: number;
  failed: number;
  skipped: number;
}

export interface CachedPhotoPreview {
  photoId: string;
  previewUrl: string;
  thumbnailUrl: string;
}

export async function listCameras(): Promise<CameraDevice[]> {
  if (!canUseTauri()) {
    return mockCameras;
  }

  return invoke<CameraDevice[]>("list_cameras");
}

export interface PhotoBatchEvent {
  cameraId: string;
  photos: CameraPhoto[];
  done: boolean;
}

export interface PhotoStreamHandle {
  // 后端报的总数，用于显示进度；照片本体经 onBatch 分批到达
  total: number;
  // 取消订阅。切相机或组件卸载时必须调用
  cancel: () => void;
}

// 渐进式枚举：命令只触发，照片经 photos:batch 事件分批到达，
// 首屏不必等整卡枚举完成。浏览器（无 Tauri）下用 mock 分批模拟同样的时序。
export async function streamPhotos(
  cameraId: string,
  onBatch: (batch: PhotoBatchEvent) => void,
): Promise<PhotoStreamHandle> {
  if (!canUseTauri()) {
    const photos = mockPhotos.filter((photo) => photo.cameraId === cameraId);
    let cancelled = false;

    // 用微任务投递，保持与 Tauri 路径一致的「先返回句柄、后到数据」时序
    void Promise.resolve().then(() => {
      if (!cancelled) {
        onBatch({ cameraId, done: true, photos });
      }
    });

    return {
      total: photos.length,
      cancel: () => {
        cancelled = true;
      },
    };
  }

  // 先订阅再触发，避免第一批事件比监听器早到而丢失
  const unlisten = await listen<PhotoBatchEvent>("photos:batch", (event) => {
    if (event.payload.cameraId === cameraId) {
      onBatch(event.payload);
    }
  });

  try {
    const started = await invoke<{ cameraId: string; total: number }>("list_photos", {
      cameraId,
    });
    return { total: started.total, cancel: unlisten };
  } catch (error) {
    unlisten();
    throw error;
  }
}

export async function openImageCapture(): Promise<void> {
  if (!canUseTauri()) {
    return;
  }

  await invoke("open_image_capture");
}

export async function cachePhotoPreview(
  cameraId: string,
  photoId: string,
): Promise<CachedPhotoPreview> {
  if (!canUseTauri()) {
    const photo = mockPhotos.find((item) => item.cameraId === cameraId && item.id === photoId);
    return {
      photoId,
      previewUrl: photo?.previewUrl ?? "",
      thumbnailUrl: photo?.thumbnailUrl ?? "",
    };
  }

  return invoke<CachedPhotoPreview>("cache_photo_preview", { cameraId, photoId });
}

export async function cachePhotoPreviews(
  cameraId: string,
  photoIds: string[],
  options: { previewPhotoIds?: string[] } = {},
): Promise<CachedPhotoPreview[]> {
  if (photoIds.length === 0) {
    return [];
  }

  if (!canUseTauri()) {
    return photoIds.map((photoId) => {
      const photo = mockPhotos.find((item) => item.cameraId === cameraId && item.id === photoId);
      return {
        photoId,
        previewUrl: photo?.previewUrl ?? "",
        thumbnailUrl: photo?.thumbnailUrl ?? "",
      };
    });
  }

  return invoke<CachedPhotoPreview[]>("cache_photo_previews", {
    cameraId,
    photoIds,
    previewPhotoIds: options.previewPhotoIds ?? [],
  });
}

export async function setPhotoRating(
  photoId: string,
  rating: Rating,
): Promise<CameraPhoto> {
  if (!canUseTauri()) {
    const photo = mockPhotos.find((item) => item.id === photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }
    photo.rating = rating;
    return photo;
  }

  return invoke<CameraPhoto>("set_photo_rating", { photoId, rating });
}

export async function exportPhotos(
  request: ExportPhotosRequest,
): Promise<ExportPhotosSummary> {
  if (!canUseTauri()) {
    const available = new Set(
      mockPhotos
        .filter((photo) => photo.cameraId === request.cameraId)
        .map((photo) => photo.id),
    );
    const copied = request.photoIds.filter((photoId) => available.has(photoId)).length;

    return {
      copied,
      failed: request.photoIds.length - copied,
      skipped: 0,
    };
  }

  return invoke<ExportPhotosSummary>("export_photos", {
    cameraId: request.cameraId,
    destinationDir: request.destinationDir,
    photoIds: request.photoIds,
  });
}

const mockCameras: CameraDevice[] = [
  {
    id: "z6iii",
    name: "Nikon Z6III",
    model: "Z6III",
    connection: "mock",
  },
];

const mockPhotos: CameraPhoto[] = [
  {
    id: "dsc-6312",
    cameraId: "z6iii",
    fileName: "DSC_6312.JPG",
    capturedAt: "2026-08-31T07:24:00.000Z",
    rating: 4,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 19.8,
    previewUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=420&q=80",
  },
  {
    id: "dsc-6328",
    cameraId: "z6iii",
    fileName: "DSC_6328.NEF",
    capturedAt: "2026-08-31T07:39:00.000Z",
    rating: 0,
    fileType: "nef",
    width: 6048,
    height: 4024,
    sizeMb: 37.2,
    previewUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=82",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=420&q=80",
  },
  {
    id: "dsc-6341",
    cameraId: "z6iii",
    fileName: "DSC_6341.JPG",
    capturedAt: "2026-08-31T08:02:00.000Z",
    rating: 2,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 16.5,
    previewUrl:
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1600&q=82",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=420&q=80",
  },
  {
    id: "dsc-6370",
    cameraId: "z6iii",
    fileName: "DSC_6370.HEIF",
    capturedAt: "2026-08-31T08:44:00.000Z",
    rating: 5,
    fileType: "heif",
    width: 6048,
    height: 4024,
    sizeMb: 12.9,
    previewUrl:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=82",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=420&q=80",
  },
  {
    id: "dsc-6404",
    cameraId: "z6iii",
    fileName: "DSC_6404.JPG",
    capturedAt: "2026-08-31T09:12:00.000Z",
    rating: 1,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 18.1,
    previewUrl:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=82",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=420&q=80",
  },
];
