import { type Locale, t } from "../../i18n";

export type ZoomAction =
  | "in"
  | "out"
  | "fit"
  | "actual"
  | { type: "scale"; scale: number }
  | { type: "scale-factor"; factor: number };

export interface PhotoZoomState {
  mode: "fit" | "scaled";
  scale: number;
}

export interface PhotoPanState {
  x: number;
  y: number;
}

const minScale = 1;
const maxScale = 4;
const scaleStep = 0.25;

export function createFitZoomState(): PhotoZoomState {
  return {
    mode: "fit",
    scale: 1,
  };
}

export function createFitPanState(): PhotoPanState {
  return {
    x: 0,
    y: 0,
  };
}

export function applyZoomAction(
  state: PhotoZoomState,
  action: ZoomAction,
): PhotoZoomState {
  if (typeof action !== "string") {
    if (action.type === "scale-factor") {
      return applyZoomScale(state, action.factor);
    }

    return createScaledZoomState(action.scale);
  }

  if (action === "fit") {
    return createFitZoomState();
  }

  if (action === "actual") {
    return {
      mode: "scaled",
      scale: 1,
    };
  }

  if (action === "out") {
    const nextScale = state.scale - scaleStep;
    if (state.mode === "fit" || nextScale <= minScale) {
      return createFitZoomState();
    }

    return {
      mode: "scaled",
      scale: nextScale,
    };
  }

  return {
    mode: "scaled",
    scale: clampScale(state.scale + scaleStep),
  };
}

export function applyZoomScale(
  state: PhotoZoomState,
  factor: number,
): PhotoZoomState {
  const baseScale = state.mode === "fit" ? 1 : state.scale;

  return createScaledZoomState(baseScale * factor);
}

export function applyPanDrag(
  state: PhotoPanState,
  delta: PhotoPanState,
): PhotoPanState {
  return {
    x: state.x + delta.x,
    y: state.y + delta.y,
  };
}

export function formatPhotoTransform(
  zoom: PhotoZoomState,
  pan: PhotoPanState,
): string | undefined {
  if (zoom.mode === "fit") {
    return undefined;
  }

  return `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom.scale})`;
}

export function canStartPanDrag({
  button,
  canDragPhoto,
}: {
  button: number;
  canDragPhoto: boolean;
}): boolean {
  return canDragPhoto && (button === 0 || button === -1);
}

export function hasPhotoPan(state: PhotoPanState): boolean {
  return state.x !== 0 || state.y !== 0;
}

function createScaledZoomState(scale: number): PhotoZoomState {
  return {
    mode: "scaled",
    scale: clampScale(scale),
  };
}

export function formatZoomLabel(state: PhotoZoomState, locale?: Locale) {
  return state.mode === "fit"
    ? t("zoom.fit", undefined, locale)
    : `${Math.round(state.scale * 100)}%`;
}

function clampScale(scale: number) {
  return Math.min(Math.max(scale, minScale), maxScale);
}
