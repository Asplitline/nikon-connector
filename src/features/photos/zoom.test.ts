import { describe, expect, it } from "vitest";
import {
  applyPanDrag,
  applyZoomAction,
  applyZoomScale,
  canStartPanDrag,
  createFitPanState,
  createFitZoomState,
  formatPhotoTransform,
  hasPhotoPan,
} from "./zoom";

describe("photo preview zoom", () => {
  it("starts in fit mode", () => {
    expect(createFitZoomState()).toEqual({ mode: "fit", scale: 1 });
  });

  it("zooms in and out with clamped scale", () => {
    const fit = createFitZoomState();
    const zoomed = applyZoomAction(fit, "in");
    const reduced = applyZoomAction(zoomed, "out");

    expect(zoomed).toEqual({ mode: "scaled", scale: 1.25 });
    expect(reduced).toEqual({ mode: "fit", scale: 1 });

    let tiny = createFitZoomState();
    for (let index = 0; index < 8; index += 1) {
      tiny = applyZoomAction(tiny, "out");
    }
    expect(tiny).toEqual({ mode: "fit", scale: 1 });

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

  it("returns to fit mode when zooming out reaches actual size", () => {
    const zoomed = applyZoomAction(createFitZoomState(), "in");

    expect(applyZoomAction(zoomed, "out")).toEqual({ mode: "fit", scale: 1 });
  });

  it("applies gesture scale changes within the zoom limits", () => {
    expect(applyZoomScale(createFitZoomState(), 1.5)).toEqual({
      mode: "scaled",
      scale: 1.5,
    });
    expect(applyZoomScale({ mode: "scaled", scale: 3 }, 2)).toEqual({
      mode: "scaled",
      scale: 4,
    });
    expect(applyZoomScale({ mode: "scaled", scale: 0.5 }, 0.1)).toEqual({
      mode: "scaled",
      scale: 1,
    });
  });

  it("applies wheel scale factors against the latest zoom state", () => {
    const first = applyZoomAction(createFitZoomState(), {
      type: "scale-factor",
      factor: 1.08,
    });
    const second = applyZoomAction(first, { type: "scale-factor", factor: 1.08 });

    expect(second).toEqual({
      mode: "scaled",
      scale: 1.1664,
    });
  });

  it("moves the zoomed photo by drag distance", () => {
    expect(applyPanDrag(createFitPanState(), { x: 24, y: -12 })).toEqual({
      x: 24,
      y: -12,
    });
    expect(applyPanDrag({ x: 24, y: -12 }, { x: -4, y: 8 })).toEqual({
      x: 20,
      y: -4,
    });
  });

  it("combines pan and scale in the preview transform", () => {
    expect(formatPhotoTransform({ mode: "fit", scale: 1 }, { x: 12, y: 8 })).toBeUndefined();
    expect(formatPhotoTransform({ mode: "scaled", scale: 2 }, { x: 12, y: -8 })).toBe(
      "translate3d(12px, -8px, 0) scale(2)",
    );
  });

  it("allows primary mouse and touch drags only after the photo is zoomed in", () => {
    expect(canStartPanDrag({ button: 0, canDragPhoto: true })).toBe(true);
    expect(canStartPanDrag({ button: -1, canDragPhoto: true })).toBe(true);
    expect(canStartPanDrag({ button: 2, canDragPhoto: true })).toBe(false);
    expect(canStartPanDrag({ button: 0, canDragPhoto: false })).toBe(false);
  });

  it("detects whether the zoomed photo has been moved", () => {
    expect(hasPhotoPan(createFitPanState())).toBe(false);
    expect(hasPhotoPan({ x: 1, y: 0 })).toBe(true);
    expect(hasPhotoPan({ x: 0, y: -1 })).toBe(true);
  });
});
