import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PerformancePanel } from "./PerformancePanel";

describe("performance panel UI", () => {
  it("shows frame rate and occupancy", () => {
    const markup = renderToStaticMarkup(
      <PerformancePanel
        locale="zh-CN"
        metrics={{
          fps: 60,
          memory: {
            jsHeapSizeLimit: 128 * 1024 * 1024,
            totalJSHeapSize: 80 * 1024 * 1024,
            usedJSHeapSize: 42 * 1024 * 1024,
          },
        }}
      />,
    );

    expect(markup).toContain("性能");
    expect(markup).toContain("帧率");
    expect(markup).toContain("60");
    expect(markup).toContain("占用");
    expect(markup).toContain("42.0 / 128.0 MB");
  });
});
