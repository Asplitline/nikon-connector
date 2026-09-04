import { describe, expect, it } from "vitest";
import { computeWindowRange, scrollOffsetForIndex } from "./windowing";

// 胶片条实际尺寸：148px 宽、12px 间距（PhotoStage 的 w-[148px] 与 gap-3）
const itemWidth = 148;
const gap = 12;
const stride = itemWidth + gap;

describe("computeWindowRange", () => {
  it("renders only a small slice of a large catalog", () => {
    const range = computeWindowRange({
      gap,
      itemWidth,
      scrollLeft: 0,
      total: 2477,
      viewportWidth: 1200,
    });

    expect(range.startIndex).toBe(0);
    // 1200px 视口约放 8 项，加 overscan 后远小于 2477
    expect(range.endIndex).toBeLessThan(30);
    expect(range.endIndex).toBeGreaterThan(8);
  });

  it("keeps total scrollable width stable via spacers", () => {
    const total = 500;
    const range = computeWindowRange({
      gap,
      itemWidth,
      scrollLeft: 20 * stride,
      total,
      viewportWidth: 900,
    });

    // 已渲染项自带项间 gap，但整条内容最末尾不带；两侧占位各按 stride 整数倍
    const renderedCount = range.endIndex - range.startIndex;
    const renderedWidth = renderedCount * stride - gap;
    const fullWidth = total * stride - gap;

    expect(range.startSpacer + renderedWidth + range.endSpacer).toBe(fullWidth);
  });

  it("includes overscan on both sides when scrolled into the middle", () => {
    const range = computeWindowRange({
      gap,
      itemWidth,
      overscan: 3,
      scrollLeft: 50 * stride,
      total: 200,
      viewportWidth: 800,
    });

    expect(range.startIndex).toBe(47);
    expect(range.endIndex).toBeGreaterThan(50);
  });

  it("clamps to the catalog end without overrunning", () => {
    const total = 40;
    const range = computeWindowRange({
      gap,
      itemWidth,
      scrollLeft: 1_000_000,
      total,
      viewportWidth: 800,
    });

    expect(range.endIndex).toBe(total);
    expect(range.startIndex).toBeLessThan(total);
    expect(range.endSpacer).toBe(0);
  });

  it("returns an empty window for an empty catalog", () => {
    const range = computeWindowRange({
      gap,
      itemWidth,
      scrollLeft: 0,
      total: 0,
      viewportWidth: 800,
    });

    expect(range).toEqual({ endIndex: 0, endSpacer: 0, startIndex: 0, startSpacer: 0 });
  });

  it("falls back to rendering everything when the item width is unusable", () => {
    const range = computeWindowRange({
      itemWidth: 0,
      scrollLeft: 0,
      total: 12,
      viewportWidth: 800,
    });

    expect(range.startIndex).toBe(0);
    expect(range.endIndex).toBe(12);
  });

  it("still renders one item when the viewport has not been measured yet", () => {
    const range = computeWindowRange({
      gap,
      itemWidth,
      overscan: 0,
      scrollLeft: 0,
      total: 30,
      viewportWidth: 0,
    });

    expect(range.endIndex).toBeGreaterThan(range.startIndex);
  });

  it("ignores negative scroll positions from rubber-band scrolling", () => {
    const range = computeWindowRange({
      gap,
      itemWidth,
      scrollLeft: -400,
      total: 100,
      viewportWidth: 800,
    });

    expect(range.startIndex).toBe(0);
    expect(range.startSpacer).toBe(0);
  });
});

describe("scrollOffsetForIndex", () => {
  it("scrolls left when the target sits before the viewport", () => {
    const offset = scrollOffsetForIndex({
      gap,
      index: 2,
      itemWidth,
      scrollLeft: 30 * stride,
      viewportWidth: 800,
    });

    expect(offset).toBe(2 * stride);
  });

  it("scrolls right just enough to reveal the target", () => {
    const offset = scrollOffsetForIndex({
      gap,
      index: 20,
      itemWidth,
      scrollLeft: 0,
      viewportWidth: 800,
    });

    expect(offset).toBe(20 * stride + itemWidth - 800);
  });

  it("stays put when the target is already visible", () => {
    const scrollLeft = 10 * stride;
    const offset = scrollOffsetForIndex({
      gap,
      index: 11,
      itemWidth,
      scrollLeft,
      viewportWidth: 800,
    });

    expect(offset).toBe(scrollLeft);
  });

  it("never returns a negative offset", () => {
    const offset = scrollOffsetForIndex({
      gap,
      index: 0,
      itemWidth,
      scrollLeft: 0,
      viewportWidth: 40,
    });

    expect(offset).toBeGreaterThanOrEqual(0);
  });
});
