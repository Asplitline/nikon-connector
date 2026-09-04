import { type Locale, t } from "../../i18n";

export type ZoomAction = "in" | "out" | "fit" | "actual";

export interface PhotoZoomState {
  mode: "fit" | "scaled";
  scale: number;
}

const minScale = 0.25;
const maxScale = 4;
const scaleStep = 0.25;

export function createFitZoomState(): PhotoZoomState {
  return {
    mode: "fit",
    scale: 1,
  };
}

export function applyZoomAction(
  state: PhotoZoomState,
  action: ZoomAction,
): PhotoZoomState {
  if (action === "fit") {
    return createFitZoomState();
  }

  if (action === "actual") {
    return {
      mode: "scaled",
      scale: 1,
    };
  }

  const delta = action === "in" ? scaleStep : -scaleStep;

  return {
    mode: "scaled",
    scale: clampScale(state.scale + delta),
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
