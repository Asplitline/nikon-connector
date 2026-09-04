import { useCallback, useEffect, useMemo, useState } from "react";
import { AppDialogs } from "./features/app/AppDialogs";
import { SidePanel } from "./features/app/SidePanel";
import { WorkspacePanel } from "./features/app/WorkspacePanel";
import { useAppUpdates } from "./features/app/useAppUpdates";
import { useCameraSession } from "./features/app/useCameraSession";
import { useDiagnosticActions } from "./features/app/useDiagnosticActions";
import { useGlobalErrorLog } from "./features/app/useGlobalErrorLog";
import { useReviewKeyboard } from "./features/app/useReviewKeyboard";
import { useReviewState } from "./features/app/useReviewState";
import type { ThemeMode } from "./features/app/uiTypes";
import { usePerformanceMetrics } from "./features/performance/usePerformanceMetrics";
import { selectPhoto } from "./features/photos/catalog";
import type { PhotoCatalogFilter, PhotoCatalogSort } from "./features/photos/catalog";
import type { ExportMode } from "./features/photos/exportPlan";
import type { CameraPhoto, Rating } from "./features/photos/types";
import { applyZoomAction, createFitZoomState } from "./features/photos/zoom";
import type { PhotoZoomState, ZoomAction } from "./features/photos/zoom";
import { defaultLocale, type Locale, t } from "./i18n";
import "./index.css";

function App() {
  // 本地 UI 状态:偏好、弹窗开关、筛选排序、导出设置、缩放
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [zoom, setZoom] = useState<PhotoZoomState>(() => createFitZoomState());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionCheckOpen, setConnectionCheckOpen] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<PhotoCatalogFilter>("all");
  const [catalogSort, setCatalogSort] = useState<PhotoCatalogSort>("captured_asc");
  const [exportMode, setExportMode] = useState<ExportMode>("visible");
  const [exportDestination, setExportDestination] = useState("");

  const tr = useCallback(
    (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) =>
      t(key, values, locale),
    [locale],
  );

  // 业务副作用:全部封在 hook 内,容器层只消费结果
  useGlobalErrorLog();
  const performanceMetrics = usePerformanceMetrics();
  const camera = useCameraSession(locale);
  const updates = useAppUpdates(locale, camera.setStatus);

  // 派生视图数据:筛选排序、诊断、导出选区、复盘统计
  const review = useReviewState({
    activeCamera: camera.activeCamera,
    catalog: camera.catalog,
    connectionState: camera.connectionState,
    exportMode,
    filter: catalogFilter,
    locale,
    scanError: camera.scanError,
    sort: catalogSort,
  });

  // useCameraSession 每次渲染返回新对象字面量,直接依赖 camera 会让下面的
  // callback/effect 每渲染都失效;这里只取需要的稳定引用作为依赖
  const { loadCamera, rebuildPreviewQueue, runExport, setCatalog, setStatus, updateRating } =
    camera;

  const { openImageCaptureApp, runAction } = useDiagnosticActions({
    locale,
    onRescan: loadCamera,
    onStatusMessage: setStatus,
  });

  // 可见列表或选中项变化后,重建预览加载队列
  useEffect(() => {
    if (!review.isReviewReady) {
      return;
    }

    rebuildPreviewQueue(review.catalogView.photos, review.catalogView.selectedPhotoId);
  }, [
    rebuildPreviewQueue,
    review.catalogView.photos,
    review.catalogView.selectedPhotoId,
    review.isReviewReady,
  ]);

  const handlePrimaryDiagnosticAction = useCallback(() => {
    void runAction(review.diagnostics.primaryAction.kind);
  }, [review.diagnostics.primaryAction.kind, runAction]);

  const handleZoomAction = useCallback((action: ZoomAction) => {
    setZoom((current) => applyZoomAction(current, action));
  }, []);

  // 切换照片时重置为适应窗口,避免沿用上一张的缩放位置
  const handleSelectPhoto = useCallback(
    (photoId: string) => {
      setZoom(createFitZoomState());
      setCatalog((current) => selectPhoto(current, photoId));
    },
    [setCatalog],
  );

  const handleRate = useCallback(
    (photo: CameraPhoto, rating: Rating) => void updateRating(photo, rating),
    [updateRating],
  );

  const handleExport = useCallback(() => {
    void runExport(review.exportSelection.photoIds, exportDestination.trim());
  }, [exportDestination, review.exportSelection.photoIds, runExport]);

  // 按「同一件事」把 props 分组后再下发,让区域组件的入参保持在阈值内
  const catalogControls = useMemo(
    () => ({
      filter: catalogFilter,
      onFilterChange: setCatalogFilter,
      onSortChange: setCatalogSort,
      sort: catalogSort,
    }),
    [catalogFilter, catalogSort],
  );

  const exportControls = useMemo(
    () => ({
      destination: exportDestination,
      mode: exportMode,
      onDestinationChange: setExportDestination,
      onExport: handleExport,
      onModeChange: setExportMode,
      selection: review.exportSelection,
      status: camera.exportStatus,
    }),
    [
      camera.exportStatus,
      exportDestination,
      exportMode,
      handleExport,
      review.exportSelection,
    ],
  );

  const library = useMemo(
    () => ({
      photoCount: camera.catalog.photos.length,
      ratedCount: review.ratedCount,
      visibleCount: review.visibleCount,
    }),
    [camera.catalog.photos.length, review.ratedCount, review.visibleCount],
  );

  const selection = useMemo(
    () => ({
      catalogView: review.catalogView,
      index: review.selectedIndex,
      photo: review.selectedPhoto,
    }),
    [review.catalogView, review.selectedIndex, review.selectedPhoto],
  );

  useReviewKeyboard({
    connectionState: camera.connectionState,
    filter: catalogFilter,
    onRate: handleRate,
    selectedPhoto: review.selectedPhoto,
    setCatalog,
    setZoom,
    sort: catalogSort,
  });

  return (
    <main
      className="app-shell h-screen overflow-hidden bg-canvas text-ink max-sm:h-auto max-sm:min-h-screen max-sm:overflow-auto"
      data-theme={theme}
    >
      <div className="app-frame grid h-full min-h-0 grid-cols-[248px_minmax(0,1fr)] max-nav:grid-cols-1 max-nav:grid-rows-[auto_minmax(0,1fr)] max-sm:min-h-0">
        <SidePanel
          activeCamera={camera.activeCamera}
          catalogControls={catalogControls}
          connectionLabel={review.connectionLabel}
          connectionState={camera.connectionState}
          diagnostics={review.diagnostics}
          exportControls={exportControls}
          isReviewReady={review.isReviewReady}
          library={library}
          locale={locale}
          onOpenConnectionCheck={() => setConnectionCheckOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          performanceMetrics={performanceMetrics}
          shootingReview={review.shootingReview}
          status={camera.status}
          tr={tr}
        />

        <WorkspacePanel
          diagnostics={review.diagnostics}
          isRatingDisabled={camera.connectionState !== "connected"}
          isReviewReady={review.isReviewReady}
          locale={locale}
          onOpenConnectionCheck={() => setConnectionCheckOpen(true)}
          onPrimaryDiagnosticAction={handlePrimaryDiagnosticAction}
          onRate={handleRate}
          onSelectPhoto={handleSelectPhoto}
          onZoomAction={handleZoomAction}
          ratingError={camera.ratingError}
          selection={selection}
          status={camera.status}
          tr={tr}
          zoom={zoom}
        />
      </div>

      <AppDialogs
        connectionCheckOpen={connectionCheckOpen}
        diagnostics={review.diagnostics}
        locale={locale}
        onCloseConnectionCheck={() => setConnectionCheckOpen(false)}
        onCloseSettings={() => setSettingsOpen(false)}
        onDiagnosticAction={(kind) => void runAction(kind)}
        onLocaleChange={setLocale}
        onOpenImageCapture={() => void openImageCaptureApp()}
        onPrimaryDiagnosticAction={handlePrimaryDiagnosticAction}
        onThemeChange={setTheme}
        settingsOpen={settingsOpen}
        theme={theme}
        updates={updates}
      />
    </main>
  );
}

export default App;
