import type { PickStatus, Rating } from "./types";

export type PhotoReviewShortcut =
  | { type: "move"; offset: -1 | 1 }
  | { type: "edge"; edge: "first" | "last" }
  | { type: "comment" }
  | { type: "inspector" }
  | { type: "mark"; status: Exclude<PickStatus, "none"> }
  | { type: "ratePrefix" }
  | { type: "rate"; rating: Rating }
  | { type: "zoom"; action: "in" | "out" | "fit" | "actual" };

export type PhotoReviewModeShortcut = { type: "toggle" } | { type: "exit" };

export function getPhotoReviewShortcut(key: string): PhotoReviewShortcut | null {
  if (key === "ArrowRight") {
    return { type: "move", offset: 1 };
  }

  if (key === "ArrowLeft") {
    return { type: "move", offset: -1 };
  }

  if (key === "ArrowUp") {
    return { type: "zoom", action: "in" };
  }

  if (key === "ArrowDown") {
    return { type: "zoom", action: "out" };
  }

  if (key === "Home") {
    return { type: "edge", edge: "first" };
  }

  if (key === "End") {
    return { type: "edge", edge: "last" };
  }

  if (key === "Backspace" || key === "Delete") {
    return { type: "rate", rating: 0 };
  }

  if (key === "0") {
    return { type: "rate", rating: 0 };
  }

  if (key === "+" || key === "=") {
    return { type: "zoom", action: "in" };
  }

  if (key === "-") {
    return { type: "zoom", action: "out" };
  }

  if (key.toLowerCase() === "f") {
    return { type: "zoom", action: "fit" };
  }

  if (key.toLowerCase() === "i") {
    return { type: "inspector" };
  }

  if (key.toLowerCase() === "c") {
    return { type: "comment" };
  }

  if (key.toLowerCase() === "s") {
    return { type: "ratePrefix" };
  }

  if (key.toLowerCase() === "p") {
    return { type: "mark", status: "picked" };
  }

  if (key.toLowerCase() === "x") {
    return { type: "mark", status: "rejected" };
  }

  if (key.toLowerCase() === "z") {
    return { type: "zoom", action: "actual" };
  }

  if (["1", "2", "3", "4", "5"].includes(key)) {
    return { type: "rate", rating: Number(key) as Rating };
  }

  return null;
}

export function getPhotoReviewModeShortcut(key: string): PhotoReviewModeShortcut | null {
  if (key.toLowerCase() === "v") {
    return { type: "toggle" };
  }

  if (key === "Escape") {
    return { type: "exit" };
  }

  return null;
}

export function createPhotoReviewShortcutResolver() {
  let ratingPrefixActive = false;

  return (key: string): PhotoReviewShortcut | null => {
    if (ratingPrefixActive) {
      ratingPrefixActive = false;

      if (["1", "2", "3", "4", "5"].includes(key)) {
        return { type: "rate", rating: Number(key) as Rating };
      }
    }

    const shortcut = getPhotoReviewShortcut(key);

    if (shortcut?.type === "ratePrefix") {
      ratingPrefixActive = true;
    }

    return shortcut;
  };
}

export function shouldIgnorePhotoReviewShortcut(target: EventTarget | null) {
  if (!target || typeof target !== "object") {
    return false;
  }

  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };
  const tagName = element.tagName?.toUpperCase();

  return (
    element.isContentEditable === true ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}
