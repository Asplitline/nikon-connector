import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachePhotoPreview,
  cachePhotoPreviews,
  openImageCapture,
  setPhotoRating,
  type PhotoBatchEvent,
  streamPhotos,
} from "./cameraApi";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

const invokeMock = invoke as unknown as {
  mockReset: () => void;
  mockRejectedValue: (value: unknown) => void;
  mockResolvedValue: (value: unknown) => void;
};

const listenMock = listen as unknown as {
  mockReset: () => void;
  mockImplementation: (
    handler: (
      event: string,
      callback: (payload: { payload: PhotoBatchEvent }) => void,
    ) => Promise<() => void>,
  ) => void;
};

describe("camera api", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis.window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  it("subscribes before triggering enumeration so no batch is missed", async () => {
    const calls: string[] = [];
    listenMock.mockImplementation(async () => {
      calls.push("listen");
      return () => undefined;
    });
    invokeMock.mockResolvedValue({ cameraId: "z6iii", total: 3 });

    const handle = await streamPhotos("z6iii", () => undefined);
    calls.push("invoke");

    expect(calls).toEqual(["listen", "invoke"]);
    expect(handle.total).toBe(3);
  });

  it("delivers batches for the requested camera only", async () => {
    const listeners: ((payload: { payload: PhotoBatchEvent }) => void)[] = [];
    listenMock.mockImplementation(async (_event, callback) => {
      listeners.push(callback);
      return () => undefined;
    });
    invokeMock.mockResolvedValue({ cameraId: "z6iii", total: 0 });

    const received: PhotoBatchEvent[] = [];
    await streamPhotos("z6iii", (batch) => received.push(batch));

    for (const emit of listeners) {
      emit({ payload: { cameraId: "other", done: true, photos: [] } });
      emit({ payload: { cameraId: "z6iii", done: true, photos: [] } });
    }

    expect(received).toHaveLength(1);
    expect(received[0].cameraId).toBe("z6iii");
  });

  it("unsubscribes when enumeration fails to start", async () => {
    let unlistened = false;
    listenMock.mockImplementation(async () => () => {
      unlistened = true;
    });
    invokeMock.mockRejectedValue(new Error("helper unavailable"));

    await expect(streamPhotos("z6iii", () => undefined)).rejects.toThrow(
      "helper unavailable",
    );
    expect(unlistened).toBe(true);
  });

  it("opens Image Capture through the native command", async () => {
    invokeMock.mockResolvedValue(undefined);

    await openImageCapture();

    expect(invoke).toHaveBeenCalledWith("open_image_capture");
  });

  it("caches one photo preview through the native command", async () => {
    invokeMock.mockResolvedValue({
      photoId: "photo-1",
      previewUrl: "/tmp/photo-preview.jpg",
      thumbnailUrl: "/tmp/photo-thumb.jpg",
    });

    await cachePhotoPreview("camera-1", "photo-1");

    expect(invoke).toHaveBeenCalledWith("cache_photo_preview", {
      cameraId: "camera-1",
      photoId: "photo-1",
    });
  });

  it("caches multiple photo previews through one native command", async () => {
    invokeMock.mockResolvedValue([
      {
        photoId: "photo-1",
        previewUrl: "/tmp/photo-1-preview.jpg",
        thumbnailUrl: "/tmp/photo-1-thumb.jpg",
      },
      {
        photoId: "photo-2",
        previewUrl: "/tmp/photo-2-preview.jpg",
        thumbnailUrl: "/tmp/photo-2-thumb.jpg",
      },
    ]);

    await cachePhotoPreviews("camera-1", ["photo-1", "photo-2"], {
      previewPhotoIds: ["photo-1"],
    });

    expect(invoke).toHaveBeenCalledWith("cache_photo_previews", {
      cameraId: "camera-1",
      photoIds: ["photo-1", "photo-2"],
      previewPhotoIds: ["photo-1"],
    });
  });

  it("sends the camera id when setting a photo rating", async () => {
    invokeMock.mockResolvedValue({
      cameraId: "camera-1",
      capturedAt: "2026-08-31T10:15:00.000Z",
      fileName: "DSC_1001.JPG",
      fileType: "jpg",
      height: 4024,
      id: "camera-1:1001",
      previewUrl: "",
      rating: 5,
      sizeMb: 18.4,
      thumbnailUrl: "",
      width: 6048,
    });

    await setPhotoRating("camera-1", "camera-1:1001", 5);

    expect(invoke).toHaveBeenCalledWith("set_photo_rating", {
      cameraId: "camera-1",
      photoId: "camera-1:1001",
      rating: 5,
    });
  });
});
