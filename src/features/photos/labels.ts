import { type Locale, t } from "../../i18n";
import type { PhotoCatalogFilter, PhotoCatalogSort } from "./catalog";
import type { ConnectionDiagnosticStep } from "./connectionDiagnostics";
import type { ExportMode } from "./exportPlan";
import type { CameraDevice } from "./types";
import type { ExportStatus } from "../app/uiTypes";

export const catalogFilterOptions: PhotoCatalogFilter[] = [
  "all",
  "unrated",
  "rated",
  "rating_3_plus",
  "rating_4_plus",
  "rating_5",
];

export const catalogSortOptions: PhotoCatalogSort[] = [
  "captured_asc",
  "filename_asc",
  "rating_desc",
];

export const exportModeOptions: ExportMode[] = [
  "picked",
  "unrated",
  "rating_1",
  "rating_2",
  "rating_3",
  "rating_4",
  "rating_5",
  "current",
];

export function formatCatalogFilter(filter: PhotoCatalogFilter, locale: Locale) {
  const labels: Record<PhotoCatalogFilter, string> = {
    all: t("review.filter.all", undefined, locale),
    rated: t("review.filter.rated", undefined, locale),
    rating_3_plus: t("review.filter.rating3Plus", undefined, locale),
    rating_4_plus: t("review.filter.rating4Plus", undefined, locale),
    rating_5: t("review.filter.rating5", undefined, locale),
    unrated: t("review.filter.unrated", undefined, locale),
  };

  return labels[filter];
}

export function formatCatalogSort(sort: PhotoCatalogSort, locale: Locale) {
  const labels: Record<PhotoCatalogSort, string> = {
    captured_asc: t("review.sort.capturedAsc", undefined, locale),
    filename_asc: t("review.sort.filenameAsc", undefined, locale),
    rating_desc: t("review.sort.ratingDesc", undefined, locale),
  };

  return labels[sort];
}

export function formatExportMode(mode: ExportMode, locale: Locale) {
  const labels: Record<ExportMode, string> = {
    current: t("export.mode.current", undefined, locale),
    picked: t("export.mode.picked", undefined, locale),
    rating_1: t("export.mode.rating1", undefined, locale),
    rating_2: t("export.mode.rating2", undefined, locale),
    rating_3: t("export.mode.rating3", undefined, locale),
    rating_4: t("export.mode.rating4", undefined, locale),
    rating_5: t("export.mode.rating5", undefined, locale),
    unrated: t("export.mode.unrated", undefined, locale),
  };

  return labels[mode];
}

export function formatExportStatus(status: ExportStatus, locale: Locale) {
  const labels: Record<ExportStatus, string> = {
    complete: t("export.status.complete", undefined, locale),
    error: t("export.status.error", undefined, locale),
    exporting: t("export.status.exporting", undefined, locale),
    idle: t("export.status.idle", undefined, locale),
  };

  return labels[status];
}

export function formatConnection(
  connection: CameraDevice["connection"],
  locale: Locale,
) {
  const labels: Record<CameraDevice["connection"], string> = {
    image_capture: t("format.imageCapture", undefined, locale),
    mock: t("format.mock", undefined, locale),
    nikon_sdk: t("format.nikonSdk", undefined, locale),
    usb: t("format.usb", undefined, locale),
  };

  return labels[connection];
}

export function formatDiagnosticState(
  state: ConnectionDiagnosticStep["state"],
  locale: Locale,
) {
  const labels: Record<ConnectionDiagnosticStep["state"], string> = {
    attention: t("diagnostic.state.attention", undefined, locale),
    checking: t("diagnostic.state.checking", undefined, locale),
    complete: t("diagnostic.state.complete", undefined, locale),
    pending: t("diagnostic.state.pending", undefined, locale),
    unavailable: t("diagnostic.state.unavailable", undefined, locale),
  };

  return labels[state];
}
