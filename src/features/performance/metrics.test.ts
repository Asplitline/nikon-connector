import { describe, expect, it } from "vitest";
import {
  calculateFramesPerSecond,
  formatPerformanceOccupancy,
} from "./metrics";

describe("performance metrics", () => {
  it("calculates frames per second from frame timestamps", () => {
    expect(calculateFramesPerSecond([0, 16, 32, 48, 64])).toBe(63);
  });

  it("formats heap occupancy when browser memory data is available", () => {
    expect(
      formatPerformanceOccupancy({
        jsHeapSizeLimit: 128 * 1024 * 1024,
        totalJSHeapSize: 80 * 1024 * 1024,
        usedJSHeapSize: 40 * 1024 * 1024,
      }),
    ).toBe("40.0 / 128.0 MB");
  });

  it("shows a fallback when occupancy data is unavailable", () => {
    expect(formatPerformanceOccupancy(null)).toBe("--");
  });
});
