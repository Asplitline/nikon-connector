import { describe, expect, it } from "vitest";
import { applyZoomAction, createFitZoomState } from "./zoom";

describe("photo preview zoom", () => {
  it("starts in fit mode", () => {
    expect(createFitZoomState()).toEqual({ mode: "fit", scale: 1 });
  });

  it("zooms in and out with clamped scale", () => {
    const fit = createFitZoomState();
    const zoomed = applyZoomAction(fit, "in");
    const reduced = applyZoomAction(zoomed, "out");

    expect(zoomed).toEqual({ mode: "scaled", scale: 1.25 });
    expect(reduced).toEqual({ mode: "scaled", scale: 1 });

    let tiny = createFitZoomState();
    for (let index = 0; index < 8; index += 1) {
      tiny = applyZoomAction(tiny, "out");
    }
    expect(tiny.scale).toBe(0.25);

    let huge = createFitZoomState();
    for (let index = 0; index < 20; index += 1) {
      huge = applyZoomAction(huge, "in");
    }
    expect(huge.scale).toBe(4);
  });

  it("switches between fit and actual size", () => {
    const zoomed = applyZoomAction(createFitZoomState(), "in");

    expect(applyZoomAction(zoomed, "fit")).toEqual({ mode: "fit", scale: 1 });
    expect(applyZoomAction(zoomed, "actual")).toEqual({
      mode: "scaled",
      scale: 1,
    });
  });
});
