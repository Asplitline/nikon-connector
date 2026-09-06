import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhotoDetails } from "./PhotoDetails";
import type { CameraPhoto } from "./types";

function photo(overrides: Partial<CameraPhoto> = {}): CameraPhoto {
  return {
    cameraId: "z6iii",
    capturedAt: "2026-08-31T10:15:00.000Z",
    fileName: "DSC_1001.JPG",
    fileType: "jpg",
    height: 4024,
    id: "dsc-1001",
    previewUrl: "",
    rating: 0,
    sizeMb: 18.4,
    thumbnailUrl: "",
    width: 6048,
    ...overrides,
  };
}

describe("PhotoDetails", () => {
  it("shows available shooting metadata in the right details panel", () => {
    const markup = renderToStaticMarkup(
      <PhotoDetails
        locale="zh-CN"
        photo={photo({
          aperture: "f/2.8",
          exposureCompensation: "-0.3 EV",
          focalLength: "70 mm",
          iso: 400,
          shutterSpeed: "1/500",
        })}
      />,
    );

    expect(markup).toContain("光圈");
    expect(markup).toContain("f/2.8");
    expect(markup).toContain("焦段");
    expect(markup).toContain("70 mm");
    expect(markup).toContain("ISO");
    expect(markup).toContain("400");
    expect(markup).toContain("快门");
    expect(markup).toContain("1/500");
    expect(markup).toContain("曝光补偿");
    expect(markup).toContain("-0.3 EV");
  });

  it("omits shooting metadata rows when the camera did not provide them", () => {
    const markup = renderToStaticMarkup(
      <PhotoDetails locale="zh-CN" photo={photo()} />,
    );

    expect(markup).not.toContain("光圈");
    expect(markup).not.toContain("焦段");
    expect(markup).not.toContain("ISO");
    expect(markup).not.toContain("快门");
  });
});
