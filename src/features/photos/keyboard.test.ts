import { describe, expect, it } from "vitest";
import {
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
});
