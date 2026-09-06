export type Rating = 0 | 1 | 2 | 3 | 4 | 5;

export type PickStatus = "none" | "picked" | "rejected";

export type CameraConnectionState =
  | "not_connected"
  | "connected"
  | "loading"
  | "error";

export interface CameraDevice {
  id: string;
  name: string;
  model: string;
  connection: "usb" | "mock" | "image_capture" | "nikon_sdk";
}

export interface CameraPhoto {
  id: string;
  cameraId: string;
  fileName: string;
  capturedAt: string;
  rating: Rating;
  fileType: "jpg" | "nef" | "heif";
  width: number;
  height: number;
  sizeMb: number;
  previewUrl: string;
  thumbnailUrl: string;
  pickStatus?: PickStatus;
  objectHandle?: string;
  storageId?: string;
  canDownloadOriginal?: boolean;
  hasEmbeddedPreview?: boolean;
  aperture?: string;
  exposureCompensation?: string;
  focalLength?: string;
  iso?: number;
  shutterSpeed?: string;
}

export interface PhotoCatalogState {
  photos: CameraPhoto[];
  selectedPhotoId: string | null;
}
