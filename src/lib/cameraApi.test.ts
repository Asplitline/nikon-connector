import { beforeEach, describe, expect, it, vi } from "vitest";
import { cachePhotoPreview, cachePhotoPreviews, openImageCapture } from "./cameraApi";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = invoke as unknown as {
  mockReset: () => void;
  mockResolvedValue: (value: unknown) => void;
};

describe("camera api", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis.window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
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
});
