import { describe, expect, it } from "vitest";
import {
  createPhotoCatalog,
  getCatalogView,
  getSelectedPhoto,
  selectPhoto,
  selectPhotoByOffset,
  selectPhotoEdge,
  updatePhotoPreview,
  updatePhotoPickStatus,
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
  {
    id: "dsc-1003",
    cameraId: "z6iii",
    fileName: "DSC_1003.JPG",
    capturedAt: "2026-08-31T10:22:00.000Z",
    rating: 4,
    fileType: "jpg",
    width: 6048,
    height: 4024,
    sizeMb: 21.1,
    previewUrl: "mock://preview/dsc-1003",
    thumbnailUrl: "mock://thumb/dsc-1003",
  },
];

describe("photo catalog", () => {
  it("selects the first camera photo by default", () => {
    const catalog = createPhotoCatalog(photos);

    expect(getSelectedPhoto(catalog)?.fileName).toBe("DSC_1001.JPG");
  });

  it("selects the first previewable photo by default", () => {
    const catalog = createPhotoCatalog([
      {
        ...photos[0],
        id: "dsc-1001-raw",
        fileName: "DSC_1001.NEF",
        previewUrl: "",
        thumbnailUrl: "",
      },
      {
        ...photos[1],
        id: "dsc-1002-preview",
        fileName: "DSC_1002.JPG",
        previewUrl: "",
        thumbnailUrl: "mock://thumb/dsc-1002",
      },
    ]);

    expect(catalog.selectedPhotoId).toBe("dsc-1002-preview");
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

  it("updates one photo pick status without changing selection", () => {
    const catalog = updatePhotoPickStatus(createPhotoCatalog(photos), "dsc-1002", "picked");

    expect(catalog.photos.find((photo) => photo.id === "dsc-1002")?.pickStatus)
      .toBe("picked");
    expect(catalog.selectedPhotoId).toBe("dsc-1001");
  });

  it("updates one photo preview without changing selection", () => {
    const catalog = updatePhotoPreview(createPhotoCatalog(photos), {
      photoId: "dsc-1002",
      previewUrl: "/tmp/dsc-1002-preview.jpg",
      thumbnailUrl: "/tmp/dsc-1002-thumb.jpg",
    });

    expect(catalog.selectedPhotoId).toBe("dsc-1001");
    expect(catalog.photos.find((photo) => photo.id === "dsc-1002")?.previewUrl)
      .toBe("/tmp/dsc-1002-preview.jpg");
    expect(catalog.photos.find((photo) => photo.id === "dsc-1002")?.thumbnailUrl)
      .toBe("/tmp/dsc-1002-thumb.jpg");
  });

  it("selects photos by offset and clamps at catalog edges", () => {
    const first = createPhotoCatalog(photos);
    const second = selectPhotoByOffset(first, 1);
    const third = selectPhotoByOffset(second, 1);

    expect(second.selectedPhotoId).toBe("dsc-1002");
    expect(third.selectedPhotoId).toBe("dsc-1003");
    expect(selectPhotoByOffset(third, 1).selectedPhotoId).toBe("dsc-1003");
    expect(selectPhotoByOffset(first, -1).selectedPhotoId).toBe("dsc-1001");
  });

  it("selects first or last photo without wrapping", () => {
    const second = selectPhotoByOffset(createPhotoCatalog(photos), 1);

    expect(selectPhotoEdge(second, "first").selectedPhotoId).toBe("dsc-1001");
    expect(selectPhotoEdge(second, "last").selectedPhotoId).toBe("dsc-1003");
    expect(selectPhotoEdge(createPhotoCatalog([]), "last").selectedPhotoId).toBeNull();
  });

  it("filters visible photos by rating state and threshold", () => {
    const catalog = createPhotoCatalog(photos);

    expect(getCatalogView(catalog, { filter: "unrated", sort: "captured_asc" }).photos)
      .toHaveLength(1);
    expect(
      getCatalogView(catalog, { filter: "rated", sort: "captured_asc" }).photos.map(
        (photo) => photo.id,
      ),
    ).toEqual(["dsc-1002", "dsc-1003"]);
    expect(
      getCatalogView(catalog, {
        filter: "rating_3_plus",
        sort: "captured_asc",
      }).photos.map((photo) => photo.id),
    ).toEqual(["dsc-1003"]);
  });

  it("sorts visible photos without mutating the source catalog", () => {
    const catalog = createPhotoCatalog(photos);

    expect(
      getCatalogView(catalog, { filter: "all", sort: "rating_desc" }).photos.map(
        (photo) => photo.id,
      ),
    ).toEqual(["dsc-1003", "dsc-1002", "dsc-1001"]);
    expect(
      getCatalogView(catalog, { filter: "all", sort: "filename_asc" }).photos.map(
        (photo) => photo.id,
      ),
    ).toEqual(["dsc-1001", "dsc-1002", "dsc-1003"]);
    expect(catalog.photos.map((photo) => photo.id)).toEqual([
      "dsc-1001",
      "dsc-1002",
      "dsc-1003",
    ]);
  });

  it("selects the first visible photo when the current selection is filtered out", () => {
    const catalog = createPhotoCatalog(photos);
    const view = getCatalogView(catalog, {
      filter: "rating_3_plus",
      sort: "captured_asc",
    });

    expect(view.selectedPhotoId).toBe("dsc-1003");
    expect(getSelectedPhoto(view)?.fileName).toBe("DSC_1003.JPG");
  });
});
