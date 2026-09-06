import { describe, expect, it } from "vitest";
import { buttonClass } from "./buttonStyles";

describe("button styles", () => {
  it("uses explicit disabled colors for primary buttons", () => {
    const className = buttonClass("primary");

    expect(className).toContain("disabled:border");
    expect(className).toContain("disabled:border-line");
    expect(className).toContain("disabled:bg-surface");
    expect(className).toContain("disabled:text-muted");
    expect(className).toContain("disabled:opacity-100");
  });
});
