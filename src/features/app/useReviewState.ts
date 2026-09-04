import { useMemo } from "react";
import { getCatalogView, getSelectedPhoto } from "../photos/catalog";
import type { PhotoCatalogFilter, PhotoCatalogSort } from "../photos/catalog";
import { createConnectionDiagnostics } from "../photos/connectionDiagnostics";
import type { ConnectionDiagnostics } from "../photos/connectionDiagnostics";
import { createExportSelection } from "../photos/exportPlan";
import type { ExportMode, ExportSelection } from "../photos/exportPlan";
import { createShootingReview } from "../photos/shootingReview";
import type { ShootingReview } from "../photos/shootingReview";
import type {
  CameraConnectionState,
  CameraDevice,
  CameraPhoto,
  PhotoCatalogState,
} from "../photos/types";
import { type Locale, t } from "../../i18n";

export interface ReviewState {
  // 经筛选与排序后的照片列表,以及其中的选中项
  catalogView: PhotoCatalogState;
  selectedPhoto: CameraPhoto | undefined;
  // 选中项在可见列表中的序号,从 1 开始;无选中时为 0
  selectedIndex: number;
  // 已连接真机且至少枚举到一张照片,才允许进入审阅态
  isReviewReady: boolean;
  ratedCount: number;
  visibleCount: number;
  connectionLabel: string;
  diagnostics: ConnectionDiagnostics;
  exportSelection: ExportSelection;
  shootingReview: ShootingReview;
}

/**
 * 由相机会话与本地筛选条件推导审阅态视图数据。
 *
 * 全部为纯派生值,不含副作用,便于容器层直接分发给子组件。
 *
 * @param input.catalog 相机会话持有的完整照片目录
 * @param input.filter 当前筛选条件
 * @param input.sort 当前排序方式
 * @param input.exportMode 导出范围选择,决定导出选区如何取值
 * @returns 审阅界面所需的全部派生数据
 */
export function useReviewState({
  activeCamera,
  catalog,
  connectionState,
  exportMode,
  filter,
  locale,
  scanError,
  sort,
}: {
  activeCamera: CameraDevice | null;
  catalog: PhotoCatalogState;
  connectionState: CameraConnectionState;
  exportMode: ExportMode;
  filter: PhotoCatalogFilter;
  locale: Locale;
  scanError: string | null;
  sort: PhotoCatalogSort;
}): ReviewState {
  const catalogView = useMemo(
    () => getCatalogView(catalog, { filter, sort }),
    [catalog, filter, sort],
  );
  const selectedPhoto = useMemo(() => getSelectedPhoto(catalogView), [catalogView]);

  // mock 连接只用于本地开发,不进入审阅态
  const isRealCamera = activeCamera?.connection !== "mock";
  const isConnectedToRealCamera = connectionState === "connected" && isRealCamera;
  const isReviewReady = isConnectedToRealCamera && catalog.photos.length > 0;

  const selectedIndex = selectedPhoto
    ? catalogView.photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1
    : 0;
  const ratedCount = isConnectedToRealCamera
    ? catalog.photos.filter((photo) => photo.rating > 0).length
    : 0;

  const diagnostics = useMemo(
    () =>
      createConnectionDiagnostics({
        camera: activeCamera,
        connectionState,
        locale,
        photoCount: catalog.photos.length,
        scanError,
      }),
    [activeCamera, catalog.photos.length, connectionState, locale, scanError],
  );

  const exportSelection = useMemo(
    () =>
      createExportSelection({
        mode: exportMode,
        photos: catalog.photos,
        selectedPhotoId: selectedPhoto?.id ?? null,
        visiblePhotos: catalogView.photos,
      }),
    [catalog.photos, catalogView.photos, exportMode, selectedPhoto?.id],
  );

  const shootingReview = useMemo(
    () => createShootingReview(catalog.photos),
    [catalog.photos],
  );

  const connectionLabel = isReviewReady
    ? t("connection.ready", undefined, locale)
    : connectionState === "loading"
      ? t("connection.scanning", undefined, locale)
      : connectionState === "error"
        ? t("connection.needsAttention", undefined, locale)
        : t("connection.noCamera", undefined, locale);

  return {
    catalogView,
    connectionLabel,
    diagnostics,
    exportSelection,
    isReviewReady,
    ratedCount,
    selectedIndex,
    selectedPhoto,
    shootingReview,
    visibleCount: catalogView.photos.length,
  };
}
