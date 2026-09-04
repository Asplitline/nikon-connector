import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Filmstrip } from "./PhotoStage";
import type { CameraPhoto } from "./types";

function photo(id: string, thumbnailUrl = ""): CameraPhoto {
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
    previewUrl: "",
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

  it("renders nothing but the container for an empty catalog", () => {
    const markup = renderToStaticMarkup(
      <Filmstrip locale="zh-CN" onSelect={() => undefined} photos={[]} selectedPhotoId={null} />,
    );

    expect(countItems(markup)).toBe(0);
  });
});
