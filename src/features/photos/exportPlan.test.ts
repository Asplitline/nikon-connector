import { describe, expect, it } from "vitest";
import { createExportSelection, estimateExportSize } from "./exportPlan";
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
    sizeMb: 12.9,
    thumbnailUrl: "",
    width: 6048,
  },
];

describe("export plan", () => {
  it("exports the current filtered result in visible order", () => {
    const selection = createExportSelection({
      mode: "visible",
      photos,
      selectedPhotoId: "dsc-6328",
      visiblePhotos: [photos[2], photos[0]],
    });

    expect(selection.photoIds).toEqual(["dsc-6370", "dsc-6312"]);
    expect(selection.count).toBe(2);
  });

  it("exports only photos at or above the requested rating threshold", () => {
    const selection = createExportSelection({
      mode: "rating_5",
      photos,
      selectedPhotoId: "dsc-6312",
      visiblePhotos: photos,
    });

    expect(selection.photoIds).toEqual(["dsc-6370"]);
  });

  it("exports the current photo for one-off use", () => {
    const selection = createExportSelection({
      mode: "current",
      photos,
      selectedPhotoId: "dsc-6328",
      visiblePhotos: [photos[0]],
    });

    expect(selection.photoIds).toEqual(["dsc-6328"]);
  });

  it("estimates total export size from selected photos", () => {
    expect(estimateExportSize(photos, ["dsc-6370", "dsc-6312"])).toBeCloseTo(
      32.7,
    );
  });
});
