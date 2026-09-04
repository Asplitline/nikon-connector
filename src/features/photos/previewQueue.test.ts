import { describe, expect, it } from "vitest";
import { createPreviewQueue } from "./previewQueue";
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

describe("preview queue", () => {
  it("prioritizes the selected photo then nearby uncached photos", () => {
    const queue = createPreviewQueue({
      photos: [
        photo("one"),
        photo("two", "/cache/two-preview.jpg", "/cache/two-thumb.jpg"),
        photo("three"),
        photo("four"),
        photo("five"),
      ],
      selectedPhotoId: "three",
      inFlightPhotoIds: new Set(),
      radius: 1,
    });

    expect(queue.map((item) => item.id)).toEqual(["three", "four"]);
  });

  it("does not request cached or in-flight previews", () => {
    const queue = createPreviewQueue({
      photos: [photo("one"), photo("two"), photo("three")],
      selectedPhotoId: "two",
      inFlightPhotoIds: new Set(["two"]),
      radius: 1,
    });

    expect(queue.map((item) => item.id)).toEqual(["one", "three"]);
  });
});
