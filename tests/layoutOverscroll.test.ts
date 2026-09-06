import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("layout overscroll guard", () => {
  it("prevents page-level horizontal rubber-band outside scrollable regions", () => {
    const css = readFileSync("src/index.css", "utf8");

    expect(css).toContain("overscroll-behavior-x: none");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("overscroll-behavior-x: contain");
  });
});
