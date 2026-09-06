import { describe, expect, it } from "vitest";
import {
  createPreviewPlan,
  createPreviewQueue,
  createPreviewRequestBatches,
  needsTier,
  previewLookaheadForWindow,
  previewRequestKey,
} from "./previewQueue";
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

  it("upgrades the selected photo from thumbnail-only to preview", () => {
    // 只有缩略图的选中项必须能继续请求大图，这是渐进式细化的前提
    const plan = createPreviewPlan({
      photos: [photo("only-thumb", "", "/cache/only-thumb.jpg")],
      selectedPhotoId: "only-thumb",
      inFlightPhotoIds: new Set(),
      radius: 0,
    });

    expect(plan).toEqual([
      { photo: expect.objectContaining({ id: "only-thumb" }), tier: "preview" },
    ]);
  });

  it("leaves neighbours alone once they have a thumbnail", () => {
    const plan = createPreviewPlan({
      photos: [
        photo("left", "", "/cache/left-thumb.jpg"),
        photo("center"),
        photo("right", "", "/cache/right-thumb.jpg"),
      ],
      selectedPhotoId: "center",
      inFlightPhotoIds: new Set(),
      radius: 1,
    });

    expect(plan.map((item) => `${item.photo.id}:${item.tier}`)).toEqual(["center:preview"]);
  });

  it("asks for the preview tier only until the preview exists", () => {
    const inFlight = new Set<string>();

    expect(needsTier(photo("a"), "preview", inFlight)).toBe(true);
    expect(needsTier(photo("a", "", "/thumb.jpg"), "preview", inFlight)).toBe(true);
    expect(needsTier(photo("a", "/preview.jpg", "/thumb.jpg"), "preview", inFlight)).toBe(
      false,
    );
  });

  it("treats any cached tier as enough for the thumbnail tier", () => {
    const inFlight = new Set<string>();

    expect(needsTier(photo("a"), "thumbnail", inFlight)).toBe(true);
    expect(needsTier(photo("a", "", "/thumb.jpg"), "thumbnail", inFlight)).toBe(false);
    expect(needsTier(photo("a", "/preview.jpg"), "thumbnail", inFlight)).toBe(false);
  });

  it("never re-requests a photo that is already in flight", () => {
    const inFlight = new Set(["a"]);

    expect(needsTier(photo("a"), "preview", inFlight)).toBe(false);
    expect(needsTier(photo("a"), "thumbnail", inFlight)).toBe(false);
  });

  it("preloads the next screen as preview tier after the selected photo", () => {
    const plan = createPreviewPlan({
      photos: [
        photo("one"),
        photo("two"),
        photo("three"),
        photo("four"),
        photo("five"),
        photo("six"),
      ],
      selectedPhotoId: "two",
      inFlightPhotoIds: new Set(),
      previewLookahead: 3,
      radius: 1,
    });

    expect(plan.map((item) => `${item.photo.id}:${item.tier}`)).toEqual([
      "two:preview",
      "three:preview",
      "four:preview",
      "five:preview",
      "one:thumbnail",
    ]);
  });

  it("does not let an in-flight thumbnail block selected preview upgrade", () => {
    const plan = createPreviewPlan({
      photos: [photo("selected", "", "/cache/selected-thumb.jpg")],
      selectedPhotoId: "selected",
      inFlightPhotoIds: new Set([previewRequestKey("selected", "thumbnail")]),
      radius: 0,
    });

    expect(plan).toEqual([
      { photo: expect.objectContaining({ id: "selected" }), tier: "preview" },
    ]);
  });

  it("deduplicates by photo and tier when tier-aware keys are used", () => {
    const inFlight = new Set([previewRequestKey("a", "preview")]);

    expect(needsTier(photo("a"), "preview", inFlight)).toBe(false);
    expect(needsTier(photo("a"), "thumbnail", inFlight)).toBe(true);
  });

  it("splits the selected preview into the first request batch", () => {
    const plan = createPreviewPlan({
      photos: [photo("one"), photo("two"), photo("three"), photo("four")],
      selectedPhotoId: "two",
      inFlightPhotoIds: new Set(),
      previewLookahead: 2,
      radius: 1,
    });

    const batches = createPreviewRequestBatches(plan, "two");

    expect(
      batches.map((batch) => ({
        photoIds: batch.items.map((item) => item.photo.id),
        previewPhotoIds: batch.previewPhotoIds,
      })),
    ).toEqual([
      { photoIds: ["two"], previewPhotoIds: ["two"] },
      { photoIds: ["three", "four", "one"], previewPhotoIds: ["three", "four"] },
    ]);
  });

  it("derives lookahead from the measured filmstrip window instead of a fixed 8", () => {
    expect(
      previewLookaheadForWindow({
        fallback: 8,
        visibleWindow: { endIndex: 18, startIndex: 2 },
      }),
    ).toBe(16);
  });

  it("queues thumbnails for the measured visible window even when it is away from the selected photo", () => {
    const photos = Array.from({ length: 80 }, (_, index) => photo(`p${index}`));

    const plan = createPreviewPlan({
      photos,
      selectedPhotoId: "p2",
      inFlightPhotoIds: new Set(),
      previewLookahead: 2,
      radius: 1,
      visibleWindow: { startIndex: 40, endIndex: 44 },
    });

    expect(plan.map((item) => `${item.photo.id}:${item.tier}`)).toEqual([
      "p2:preview",
      "p3:preview",
      "p4:preview",
      "p1:thumbnail",
      "p40:thumbnail",
      "p41:thumbnail",
      "p42:thumbnail",
      "p43:thumbnail",
    ]);
  });

  it("keeps a fallback lookahead before the filmstrip has been measured", () => {
    expect(previewLookaheadForWindow({ fallback: 8, visibleWindow: null })).toBe(8);
  });
});
