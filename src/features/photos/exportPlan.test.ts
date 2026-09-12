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
    pickStatus: "none",
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
    pickStatus: "rejected",
    sizeMb: 12.9,
    thumbnailUrl: "",
    width: 6048,
  },
];

describe("export plan", () => {
  it("exports only photos at the requested rating or unrated state", () => {
    const unratedSelection = createExportSelection({
      mode: "unrated",
      photos,
      selectedPhotoId: "dsc-6312",
      visiblePhotos: photos,
    });
    const selection = createExportSelection({
      mode: "rating_4",
      photos,
      selectedPhotoId: "dsc-6312",
      visiblePhotos: photos,
    });

    expect(unratedSelection.photoIds).toEqual(["dsc-6328"]);
    expect(selection.photoIds).toEqual(["dsc-6312"]);
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

  it("exports only explicitly picked photos for selected exports", () => {
    const selection = createExportSelection({
      mode: "picked",
      photos,
      selectedPhotoId: "dsc-6328",
      visiblePhotos: photos,
    });

    expect(selection.photoIds).toEqual(["dsc-6312"]);
  });

  it("estimates total export size from selected photos", () => {
    expect(estimateExportSize(photos, ["dsc-6370", "dsc-6312"])).toBeCloseTo(
      32.7,
    );
  });
});
