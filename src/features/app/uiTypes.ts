import type { AvailableUpdate } from "../../lib/appApi";
import type { PhotoCatalogSort } from "../photos/catalog";
import type { ExportMode, ExportSelection } from "../photos/exportPlan";

export type ThemeMode = "light" | "dark";

export type ExportStatus = "idle" | "exporting" | "complete" | "error";

export type LogStatus = "idle" | "clearing" | "exporting" | "error";

export type UpdateStatus =
  | { state: "idle"; message: string }
  | { state: "checking"; message: string }
  | { state: "available"; message: string; update: AvailableUpdate }
  | { state: "installing"; message: string }
  | { state: "error"; message: string };

// 容器级组件的 props 分组:把「同一件事」的字段与回调收成一组,
// 避免区域组件的 props 数量随子面板增加而线性膨胀
export interface ExportControls {
  destination: string;
  mode: ExportMode;
  onDestinationChange: (destination: string) => void;
  onExport: () => void;
  onModeChange: (mode: ExportMode) => void;
  selection: ExportSelection;
  status: ExportStatus;
}

export interface CatalogControls {
  onSortChange: (sort: PhotoCatalogSort) => void;
  sort: PhotoCatalogSort;
}

export interface LibraryStats {
  photoCount: number;
  ratedCount: number;
  visibleCount: number;
}
