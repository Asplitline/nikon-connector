import { describe, expect, it } from "vitest";
import {
  createPhotoStream,
  markPhotoStreamFailed,
  mergePhotoBatch,
} from "./photoStream";
import type { CameraPhoto } from "./types";

function photo(id: string, previewUrl = "", thumbnailUrl = ""): CameraPhoto {
  return {
    id,
    cameraId: "z6iii",
    fileName: `${id}.JPG`,
    capturedAt: "2026-08-31T10:15:00.000Z",
    rating: 0,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 18.4,
    previewUrl,
    thumbnailUrl,
  };
}

describe("photo stream", () => {
  it("starts empty and not done", () => {
    const state = createPhotoStream();

    expect(state).toEqual({ done: false, error: null, photos: [] });
  });

  it("accumulates batches in arrival order", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a"), photo("b")] });
    state = mergePhotoBatch(state, { photos: [photo("c")] });

    expect(state.photos.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(state.done).toBe(false);
  });

  it("deduplicates photos that arrive twice", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a"), photo("b")] });
    state = mergePhotoBatch(state, { photos: [photo("a"), photo("c")] });

    expect(state.photos.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("upgrades a photo when a later batch carries its preview", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a", "", "/thumb.jpg")] });
    state = mergePhotoBatch(state, { photos: [photo("a", "/preview.jpg")] });

    expect(state.photos[0].previewUrl).toBe("/preview.jpg");
    // 新批次没带缩略图时不能把已有的清掉
    expect(state.photos[0].thumbnailUrl).toBe("/thumb.jpg");
  });

  it("never clears a cached url with an empty one", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, {
      photos: [photo("a", "/preview.jpg", "/thumb.jpg")],
    });
    state = mergePhotoBatch(state, { photos: [photo("a")] });

    expect(state.photos[0].previewUrl).toBe("/preview.jpg");
    expect(state.photos[0].thumbnailUrl).toBe("/thumb.jpg");
  });

  it("keeps non-url fields from the newer batch", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a")] });

    const rated = { ...photo("a"), rating: 5 as const };
    state = mergePhotoBatch(state, { photos: [rated] });

    expect(state.photos[0].rating).toBe(5);
  });

  it("marks the stream done on the final batch", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { done: true, photos: [photo("a")] });

    expect(state.done).toBe(true);
    expect(state.photos).toHaveLength(1);
  });

  it("accepts an empty final batch as the done signal", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a")] });
    state = mergePhotoBatch(state, { done: true, photos: [] });

    expect(state.done).toBe(true);
    expect(state.photos).toHaveLength(1);
  });

  it("returns the same state for a no-op batch", () => {
    const state = mergePhotoBatch(createPhotoStream(), { photos: [] });

    expect(state.done).toBe(false);
    expect(state.photos).toHaveLength(0);
  });

  it("keeps already-received photos when enumeration fails", () => {
    let state = createPhotoStream();
    state = mergePhotoBatch(state, { photos: [photo("a"), photo("b")] });
    state = markPhotoStreamFailed(state, "camera disconnected");

    expect(state.error).toBe("camera disconnected");
    expect(state.done).toBe(true);
    expect(state.photos.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the previous state", () => {
    const first = mergePhotoBatch(createPhotoStream(), { photos: [photo("a")] });
    const second = mergePhotoBatch(first, { photos: [photo("b")] });

    expect(first.photos).toHaveLength(1);
    expect(second.photos).toHaveLength(2);
    expect(second.photos).not.toBe(first.photos);
  });

  it("handles a large streamed catalog without losing photos", () => {
    let state = createPhotoStream();

    for (let batch = 0; batch < 50; batch += 1) {
      const photos = Array.from({ length: 50 }, (_, index) =>
        photo(`p${batch * 50 + index}`),
      );
      state = mergePhotoBatch(state, { photos });
    }

    expect(state.photos).toHaveLength(2500);
    expect(new Set(state.photos.map((item) => item.id)).size).toBe(2500);
  });
});
