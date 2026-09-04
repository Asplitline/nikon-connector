import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShootingReviewPanel } from "./ShootingReviewPanel";

describe("shooting review panel UI", () => {
  it("shows the rating summary and format mix", () => {
    const markup = renderToStaticMarkup(
      <ShootingReviewPanel
        locale="zh-CN"
        review={{
          firstCapturedAt: "2026-08-31T07:24:00.000Z",
          formats: { jpg: 2, nef: 1 },
          keepRate: 0.25,
          keepers: 3,
          lastCapturedAt: "2026-08-31T08:44:00.000Z",
          rated: 8,
          total: 12,
          unrated: 4,
        }}
      />,
    );

    expect(markup).toContain("拍摄复盘");
    expect(markup).toContain("精选");
    expect(markup).toContain("25%");
    expect(markup).toContain("JPG 2");
    expect(markup).toContain("NEF 1");
  });
});
