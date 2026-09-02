import type { Rating } from "./types";

export type PhotoReviewShortcut =
  | { type: "move"; offset: -1 | 1 }
  | { type: "edge"; edge: "first" | "last" }
  | { type: "rate"; rating: Rating }
  | { type: "zoom"; action: "in" | "out" | "fit" | "actual" };

export function getPhotoReviewShortcut(key: string): PhotoReviewShortcut | null {
  if (key === "ArrowRight") {
    return { type: "move", offset: 1 };
  }

  if (key === "ArrowLeft") {
    return { type: "move", offset: -1 };
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

  if (key === "+" || key === "=") {
    return { type: "zoom", action: "in" };
  }

  if (key === "-") {
    return { type: "zoom", action: "out" };
  }

  if (key.toLowerCase() === "f") {
    return { type: "zoom", action: "fit" };
  }

  if (key.toLowerCase() === "z") {
    return { type: "zoom", action: "actual" };
  }

  if (["1", "2", "3", "4", "5"].includes(key)) {
    return { type: "rate", rating: Number(key) as Rating };
  }

  return null;
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
