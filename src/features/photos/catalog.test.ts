import { describe, expect, it } from "vitest";
import {
  createPhotoCatalog,
  getSelectedPhoto,
  selectPhoto,
  updatePhotoRating,
} from "./catalog";
import type { CameraPhoto } from "./types";

const photos: CameraPhoto[] = [
  {
    id: "dsc-1001",
    cameraId: "z6iii",
    fileName: "DSC_1001.JPG",
    capturedAt: "2026-08-31T10:15:00.000Z",
    rating: 0,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 18.4,
    previewUrl: "mock://preview/dsc-1001",
    thumbnailUrl: "mock://thumb/dsc-1001",
  },
  {
    id: "dsc-1002",
    cameraId: "z6iii",
    fileName: "DSC_1002.NEF",
    capturedAt: "2026-08-31T10:18:00.000Z",
    rating: 2,
    fileType: "nef",
    width: 6048,
    height: 4024,
    sizeMb: 34.7,
    previewUrl: "mock://preview/dsc-1002",
    thumbnailUrl: "mock://thumb/dsc-1002",
  },
];

describe("photo catalog", () => {
  it("selects the first camera photo by default", () => {
    const catalog = createPhotoCatalog(photos);

    expect(getSelectedPhoto(catalog)?.fileName).toBe("DSC_1001.JPG");
  });

  it("keeps the current selection when selecting an unknown photo", () => {
    const catalog = selectPhoto(createPhotoCatalog(photos), "missing");

    expect(catalog.selectedPhotoId).toBe("dsc-1001");
  });

  it("updates one photo rating without changing selection", () => {
    const catalog = updatePhotoRating(createPhotoCatalog(photos), "dsc-1002", 5);

    expect(catalog.photos.find((photo) => photo.id === "dsc-1002")?.rating).toBe(
      5,
    );
    expect(catalog.photos.find((photo) => photo.id === "dsc-1001")?.rating).toBe(
      0,
    );
    expect(catalog.selectedPhotoId).toBe("dsc-1001");
  });
});
