import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Filmstrip, PhotoStage } from "./PhotoStage";
import { reviewImageClass } from "./photoStyles";
import { resolvePreviewSwapState } from "./previewSwap";
import type { CameraPhoto } from "./types";

function photo(id: string, thumbnailUrl = "", previewUrl = ""): CameraPhoto {
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

function countItems(markup: string) {
  return (markup.match(/data-filmstrip-item/g) ?? []).length;
}

describe("filmstrip virtualization", () => {
  it("renders only a window of a large catalog", () => {
    const photos = Array.from({ length: 2000 }, (_, index) => photo(`p${index}`));

    const markup = renderToStaticMarkup(
      <Filmstrip
        locale="zh-CN"
        onSelect={() => undefined}
        photos={photos}
        selectedPhotoId="p0"
      />,
    );

    // 首屏（视口尚未实测）也必须渲染出内容，且远少于总数
    const rendered = countItems(markup);
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100);
  });

  it("pads the scroll width with a trailing spacer", () => {
    const photos = Array.from({ length: 300 }, (_, index) => photo(`p${index}`));

    const markup = renderToStaticMarkup(
      <Filmstrip
        locale="zh-CN"
        onSelect={() => undefined}
        photos={photos}
        selectedPhotoId="p0"
      />,
    );

    expect(markup).toContain("aria-hidden");
  });

  it("renders every photo when the catalog is small", () => {
    const photos = [photo("a"), photo("b"), photo("c")];

    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={photos} selectedPhotoId="a" />,
    );

    expect(countItems(markup)).toBe(3);
    expect(markup).toContain("a.JPG");
    expect(markup).toContain("c.JPG");
  });

  it("marks the selected thumbnail for assistive tech", () => {
    const photos = [photo("a"), photo("b")];

    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={photos} selectedPhotoId="b" />,
    );

    expect(markup).toContain('aria-current="true"');
  });

  it("renders a visible selection indicator on the selected thumbnail", () => {
    const photos = [photo("a"), photo("b")];

    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={photos} selectedPhotoId="b" />,
    );

    expect(markup).toContain('data-selected-indicator="true"');
    expect(markup.match(/data-selected-indicator="true"/g)).toHaveLength(1);
  });

  it("defers offscreen thumbnail decoding to the browser", () => {
    // 用带协议的地址：imageSource 会原样返回，避免在 node 环境走
    // convertFileSrc（它依赖 window）
    const photos = [photo("a", "https://example.test/a-thumb.jpg")];

    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={photos} selectedPhotoId="a" />,
    );

    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
  });

  it("uses the preview image as a filmstrip fallback when the thumbnail is missing", () => {
    const photos = [photo("a", "", "https://example.test/a-preview.jpg")];

    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={photos} selectedPhotoId="a" />,
    );

    expect(markup).toContain('src="https://example.test/a-preview.jpg"');
  });

  it("renders nothing but the container for an empty catalog", () => {
    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={[]} selectedPhotoId={null} />,
    );

    expect(countItems(markup)).toBe(0);
  });
});

describe("photo preview image", () => {
  it("shows a compact right-side info strip when enabled", () => {
    const markup = renderToStaticMarkup(
      <div className="group">
        <PhotoStage
          infoVisible
          locale="zh-CN"
          onInfoToggle={() => undefined}
          onMark={() => undefined}
          onNext={() => undefined}
          onPrevious={() => undefined}
          onRate={() => undefined}
          onZoomAction={() => undefined}
          photo={{
            ...photo("a", "https://example.test/a-thumb.jpg", "https://example.test/a-preview.jpg"),
            aperture: "f/8",
            exposureCompensation: "0 EV",
            focalLength: "40 mm",
            iso: 100,
            shutterSpeed: "1/500",
            sizeMb: 16.2,
          }}
          zoom={{ mode: "fit", scale: 1 }}
          zoomLabel="适应"
        />
      </div>,
    );

    expect(markup).toContain("拍摄信息");
    expect(markup).not.toContain("lucide-info");
    expect(markup).toContain("lucide-aperture");
    expect(markup).toContain("JPG");
    expect(markup).toContain("6048 x 4024");
    expect(markup).toContain("16.2 MB");
    expect(markup).toContain("光圈");
    expect(markup).toContain("f/8");
    expect(markup).toContain("焦段");
    expect(markup).toContain("40 mm");
    expect(markup).toContain("ISO");
    expect(markup).toContain("100");
    expect(markup).toContain("快门");
    expect(markup).toContain("1/500");
    expect(markup).toContain("曝光补偿");
    expect(markup).toContain("0 EV");
    expect(markup).not.toContain("f/8 · 40 mm · ISO 100 · 1/500 · 0 EV");
    expect(markup).toContain('aria-label="隐藏拍摄信息"');
  });

  it("uses the workspace toolbar as the only way to reveal hidden quick info", () => {
    const markup = renderToStaticMarkup(
      <div className="group">
        <PhotoStage
          infoVisible={false}
          locale="zh-CN"
          onInfoToggle={() => undefined}
          onMark={() => undefined}
          onNext={() => undefined}
          onPrevious={() => undefined}
          onRate={() => undefined}
          onZoomAction={() => undefined}
          photo={{
            ...photo("a", "https://example.test/a-thumb.jpg", "https://example.test/a-preview.jpg"),
            sizeMb: 16.2,
          }}
          zoom={{ mode: "fit", scale: 1 }}
          zoomLabel="适应"
        />
      </div>,
    );

    expect(markup).not.toContain('aria-label="显示拍摄信息"');
    expect(markup).not.toContain("6048 x 4024");
    expect(markup).not.toContain("16.2 MB");
  });

  it("does not animate continuous gesture zoom changes", () => {
    expect(reviewImageClass(false)).not.toContain("transition-transform");
  });

  it("shows a quiet loading indicator while only the thumbnail is available", () => {
    const markup = renderToStaticMarkup(
      <div className="group">
        <PhotoStage
          locale="zh-CN"
          onMark={() => undefined}
          onNext={() => undefined}
          onPrevious={() => undefined}
          onRate={() => undefined}
          onZoomAction={() => undefined}
          photo={photo("a", "https://example.test/a-thumb.jpg")}
          zoom={{ mode: "fit", scale: 1 }}
          zoomLabel="适应"
        />
      </div>,
    );

    expect(markup).toContain("正在加载高清预览");
  });

  it("keeps secondary stage controls inside the bottom action bar", () => {
    const markup = renderToStaticMarkup(
      <div className="group">
        <PhotoStage
          bottomAccessory={
            <button aria-label="展开缩略图" type="button">
              Toggle
            </button>
          }
          locale="zh-CN"
          onMark={() => undefined}
          onNext={() => undefined}
          onPrevious={() => undefined}
          onRate={() => undefined}
          onZoomAction={() => undefined}
          photo={photo("a", "https://example.test/a-thumb.jpg")}
          zoom={{ mode: "fit", scale: 1 }}
          zoomLabel="适应"
        />
      </div>,
    );

    expect(markup).toContain('aria-label="展开缩略图"');
    expect(markup).toContain("max-w-[calc(100%-24px)]");
    expect(markup).toContain(">Toggle</button>");
  });

  it("keeps the visible thumbnail until the new preview candidate has loaded", () => {
    expect(
      resolvePreviewSwapState({
        loadedPreviewUrl: null,
        previewUrl: "https://example.test/a-preview.jpg",
        thumbnailUrl: "https://example.test/a-thumb.jpg",
        visibleUrl: "https://example.test/a-thumb.jpg",
      }),
    ).toEqual({
      isLoadingUpgrade: true,
      preloadUrl: "https://example.test/a-preview.jpg",
      visibleUrl: "https://example.test/a-thumb.jpg",
    });
  });
});
