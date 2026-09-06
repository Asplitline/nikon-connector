import { describe, expect, it } from "vitest";
import { createShootingReview } from "./shootingReview";
import type { CameraPhoto } from "./types";

const photos: CameraPhoto[] = [
  {
    cameraId: "z6iii",
    capturedAt: "2026-08-31T07:24:00.000Z",
    fileName: "DSC_6312.JPG",
    fileType: "jpg",
    height: 4024,
    id: "dsc-6312",
    previewUrl: "",
    rating: 4,
    pickStatus: "picked",
    sizeMb: 19.8,
    thumbnailUrl: "",
    width: 6048,
  },
  {
    cameraId: "z6iii",
    capturedAt: "2026-08-31T07:39:00.000Z",
    fileName: "DSC_6328.NEF",
    fileType: "nef",
    height: 4024,
    id: "dsc-6328",
    previewUrl: "",
    rating: 0,
    sizeMb: 37.2,
    thumbnailUrl: "",
    width: 6048,
  },
  {
    cameraId: "z6iii",
    capturedAt: "2026-08-31T08:44:00.000Z",
    fileName: "DSC_6370.HEIF",
    fileType: "heif",
    height: 4024,
    id: "dsc-6370",
    previewUrl: "",
    rating: 5,
    pickStatus: "picked",
    sizeMb: 12.9,
    thumbnailUrl: "",
    width: 6048,
  },
];

describe("shooting review", () => {
  it("summarizes ratings, keepers, formats, and capture span", () => {
    const review = createShootingReview(photos);

    expect(review.total).toBe(3);
    expect(review.rated).toBe(2);
    expect(review.keepers).toBe(2);
    expect(review.unrated).toBe(1);
    expect(review.keepRate).toBeCloseTo(2 / 3);
    expect(review.formats).toEqual({ heif: 1, jpg: 1, nef: 1 });
    expect(review.firstCapturedAt).toBe("2026-08-31T07:24:00.000Z");
    expect(review.lastCapturedAt).toBe("2026-08-31T08:44:00.000Z");
  });
});
