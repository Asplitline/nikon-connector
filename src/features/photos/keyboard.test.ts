import { describe, expect, it } from "vitest";
import {
  createPhotoReviewShortcutResolver,
  getPhotoReviewModeShortcut,
  getPhotoReviewShortcut,
  shouldIgnorePhotoReviewShortcut,
} from "./keyboard";

describe("photo review keyboard shortcuts", () => {
  it.each([
    ["ArrowRight", { type: "move", offset: 1 }],
    ["ArrowLeft", { type: "move", offset: -1 }],
    ["Home", { type: "edge", edge: "first" }],
    ["End", { type: "edge", edge: "last" }],
    ["5", { type: "rate", rating: 5 }],
    ["0", { type: "rate", rating: 0 }],
    ["p", { type: "mark", status: "picked" }],
    ["P", { type: "mark", status: "picked" }],
    ["x", { type: "mark", status: "rejected" }],
    ["X", { type: "mark", status: "rejected" }],
    ["c", { type: "comment" }],
    ["C", { type: "comment" }],
    ["i", { type: "inspector" }],
    ["I", { type: "inspector" }],
    ["Backspace", { type: "rate", rating: 0 }],
    ["Delete", { type: "rate", rating: 0 }],
    ["+", { type: "zoom", action: "in" }],
    ["=", { type: "zoom", action: "in" }],
    ["-", { type: "zoom", action: "out" }],
    ["ArrowUp", { type: "zoom", action: "in" }],
    ["ArrowDown", { type: "zoom", action: "out" }],
    ["f", { type: "zoom", action: "fit" }],
    ["F", { type: "zoom", action: "fit" }],
    ["z", { type: "zoom", action: "actual" }],
    ["Z", { type: "zoom", action: "actual" }],
  ] as const)("maps %s to a photo review command", (key, command) => {
    expect(getPhotoReviewShortcut(key)).toEqual(command);
  });

  it("ignores keys that are not photo review shortcuts", () => {
    expect(getPhotoReviewShortcut("Tab")).toBeNull();
    expect(getPhotoReviewShortcut("Escape")).toBeNull();
    expect(getPhotoReviewShortcut("6")).toBeNull();
  });

  it("maps s followed by a rating number to a rating command", () => {
    const resolveShortcut = createPhotoReviewShortcutResolver();

    expect(resolveShortcut("s")).toEqual({ type: "ratePrefix" });
    expect(resolveShortcut("5")).toEqual({ type: "rate", rating: 5 });
    expect(resolveShortcut("S")).toEqual({ type: "ratePrefix" });
    expect(resolveShortcut("1")).toEqual({ type: "rate", rating: 1 });
  });

  it("falls back to normal shortcuts when a rating sequence is abandoned", () => {
    const resolveShortcut = createPhotoReviewShortcutResolver();

    expect(resolveShortcut("s")).toEqual({ type: "ratePrefix" });
    expect(resolveShortcut("ArrowRight")).toEqual({ type: "move", offset: 1 });
    expect(resolveShortcut("5")).toEqual({ type: "rate", rating: 5 });
  });

  it("does not run shortcuts while users are editing text", () => {
    const input = { tagName: "INPUT", isContentEditable: false };
    const textarea = { tagName: "TEXTAREA", isContentEditable: false };
    const select = { tagName: "SELECT", isContentEditable: false };
    const editable = { tagName: "DIV", isContentEditable: true };
    const button = { tagName: "BUTTON", isContentEditable: false };

    expect(shouldIgnorePhotoReviewShortcut(input as unknown as EventTarget)).toBe(true);
    expect(shouldIgnorePhotoReviewShortcut(textarea as unknown as EventTarget)).toBe(true);
    expect(shouldIgnorePhotoReviewShortcut(select as unknown as EventTarget)).toBe(true);
    expect(shouldIgnorePhotoReviewShortcut(editable as unknown as EventTarget)).toBe(true);
    expect(shouldIgnorePhotoReviewShortcut(button as unknown as EventTarget)).toBe(
      false,
    );
    expect(shouldIgnorePhotoReviewShortcut(null)).toBe(false);
  });

  it.each([
    ["v", { type: "toggle" }],
    ["V", { type: "toggle" }],
    ["Escape", { type: "exit" }],
  ] as const)("maps %s to a review mode command", (key, command) => {
    expect(getPhotoReviewModeShortcut(key)).toEqual(command);
  });

  it("ignores keys that do not affect review mode", () => {
    expect(getPhotoReviewModeShortcut("f")).toBeNull();
    expect(getPhotoReviewModeShortcut("ArrowRight")).toBeNull();
  });
});
