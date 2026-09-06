import { useCallback, useEffect, useRef, useState } from "react";
import { type Locale, t } from "../../i18n";
import { writeAppLog } from "../../lib/appApi";
import {
  cachePhotoPreviews,
  exportPhotos,
  listCameras,
  type PhotoStreamHandle,
  setPhotoRating,
  streamPhotos,
} from "../../lib/cameraApi";
import { createSingleFlight } from "../../lib/singleFlight";
import {
  createPhotoCatalog,
  replacePhotos,
  updatePhotoPickStatus,
  updatePhotoPreview,
  updatePhotoRating,
} from "../photos/catalog";
import { createPhotoStream, mergePhotoBatch } from "../photos/photoStream";
import {
  applyLocalPickStatuses,
  applyLocalRatings,
  isLocalOnlyRatingError,
  readLocalPickStatuses,
  readLocalRatings,
  writeLocalPickStatus,
  writeLocalRating,
} from "../photos/localRatings";
import {
  createPreviewPlan,
  createPreviewRequestBatches,
  previewLookaheadForWindow,
  previewRequestKey,
  type PreviewVisibleWindow,
} from "../photos/previewQueue";
import {
  createGenerationGuard,
  createPreviewScheduler,
  type PreviewScheduler,
} from "../photos/previewScheduler";
import type {
  CameraConnectionState,
  CameraDevice,
  CameraPhoto,
  PickStatus,
  PhotoCatalogState,
  Rating,
} from "../photos/types";
import type { ExportStatus } from "./uiTypes";

// 一批预览请求的输入；相机 id 随请求带上，避免切相机后用到旧闭包
interface PreviewBatchRequest {
  cameraId: string;
  photos: CameraPhoto[];
  selectedPhotoId: string;
  visibleWindow: PreviewVisibleWindow | null;
}

// 防抖窗口：略小于连续按键间隔，既能合并连按又不让单次换图有明显延迟
const previewDebounceMs = 140;
const fallbackPreviewLookaheadCount = 8;
const thumbnailRadius = 8;

export interface CameraSession {
  activeCamera: CameraDevice | null;
  catalog: PhotoCatalogState;
  connectionState: CameraConnectionState;
  exportStatus: ExportStatus;
  loadCamera: () => Promise<void>;
  ratingError: string | null;
  rebuildPreviewQueue: (
    photos: CameraPhoto[],
    selectedPhotoId: string | null,
    options?: { visibleWindow?: PreviewVisibleWindow | null },
  ) => void;
  runExport: (photoIds: string[], destinationDir: string) => Promise<void>;
  scanError: string | null;
  setCatalog: React.Dispatch<React.SetStateAction<PhotoCatalogState>>;
  setStatus: (status: string) => void;
  status: string;
  updateRating: (photo: CameraPhoto, rating: Rating) => Promise<void>;
  updatePickStatus: (photo: CameraPhoto, status: PickStatus) => void;
}

// 相机会话：扫描连接、枚举照片、按需缓存预览、写评级、导出原图
export function useCameraSession(locale: Locale): CameraSession {
  const [connectionState, setConnectionState] =
    useState<CameraConnectionState>("loading");
  const [activeCamera, setActiveCamera] = useState<CameraDevice | null>(null);
  const [catalog, setCatalog] = useState<PhotoCatalogState>(() =>
    createPhotoCatalog([]),
  );
  const [status, setStatus] = useState(t("status.scanning"));
  const [scanError, setScanError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const inFlightPreviewIdsRef = useRef(new Set<string>());
  const previewGuardRef = useRef(createGenerationGuard());
  const photoStreamRef = useRef<PhotoStreamHandle | null>(null);

  const tr = useCallback(
    (key: Parameters<typeof t>[0], values?: Parameters<typeof t>[1]) =>
      t(key, values, locale),
    [locale],
  );

  const runCameraLoad = useCallback(async () => {
    try {
      setConnectionState("loading");
      setScanError(null);
      const nextCameras = await listCameras();

      if (nextCameras.length === 0) {
        writeAppLog("warn", "frontend.camera", "no cameras found during scan");
        setActiveCamera(null);
        setCatalog(createPhotoCatalog([]));
        setConnectionState("not_connected");
        setStatus(tr("status.connectUsb"));
        return;
      }

      const nextCamera = nextCameras[0];
      const ratings = readLocalRatings(window.localStorage, nextCamera.id);
      const pickStatuses = readLocalPickStatuses(window.localStorage, nextCamera.id);

      // 上一次枚举的订阅要先撤掉，否则旧相机的批次会混进新目录
      photoStreamRef.current?.cancel();
      photoStreamRef.current = null;
      setActiveCamera(nextCamera);
      setCatalog(createPhotoCatalog([]));

      // 渐进式接收：每批到达即合并渲染，不等整卡枚举完成
      let stream = createPhotoStream();
      const handle = await streamPhotos(nextCamera.id, (batch) => {
        stream = mergePhotoBatch(stream, {
          done: batch.done,
          photos: applyLocalPickStatuses(
            applyLocalRatings(batch.photos, ratings),
            pickStatuses,
          ),
        });
        setCatalog((current) => replacePhotos(current, stream.photos));

        if (batch.done) {
          setStatus(
            tr("status.mountedPhotos", {
              camera: nextCamera.name,
              count: stream.photos.length,
            }),
          );
        }
      });
      photoStreamRef.current = handle;

      if (nextCamera.connection === "mock") {
        setConnectionState("not_connected");
        setStatus(tr("status.demo"));
        return;
      }
      setConnectionState("connected");
      setStatus(
        tr("status.mountedPhotos", {
          camera: nextCamera.name,
          count: handle.total,
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("status.cameraScanFailed");
      setActiveCamera(null);
      setCatalog(createPhotoCatalog([]));
      setScanError(message);
      setConnectionState("error");
      setStatus(message);
      writeAppLog("error", "frontend.camera", `camera scan failed: ${message}`);
    }
  }, [tr]);

  // singleFlight 折叠并发的重复扫描。runCameraLoad 会读 ref，所以包装实例
  // 放在 ref 里而不是 useMemo 里创建（render 阶段不碰 ref）。
  const loadCameraRef = useRef<(() => Promise<void>) | null>(null);
  const loadCamera = useCallback(async () => {
    loadCameraRef.current ??= createSingleFlight(runCameraLoad);
    await loadCameraRef.current();
  }, [runCameraLoad]);

  // runCameraLoad 变了（locale 切换）就丢弃旧的折叠器
  useEffect(() => {
    loadCameraRef.current = null;
  }, [runCameraLoad]);

  useEffect(() => {
    void Promise.resolve().then(loadCamera);
  }, [loadCamera]);

  // 卸载时撤掉照片流订阅，避免 setState 打到已卸载的组件上
  useEffect(
    () => () => {
      photoStreamRef.current?.cancel();
      photoStreamRef.current = null;
    },
    [],
  );

  // 真正发起一批预览请求。经调度器防抖后调用，同一时刻只会有一批在途。
  const flushPreviewBatch = useCallback(
    async ({ cameraId, photos, selectedPhotoId, visibleWindow }: PreviewBatchRequest) => {
      const previewLookahead = previewLookaheadForWindow({
        fallback: fallbackPreviewLookaheadCount,
        visibleWindow,
      });
      const plan = createPreviewPlan({
        photos,
        selectedPhotoId,
        inFlightPhotoIds: inFlightPreviewIdsRef.current,
        previewLookahead,
        radius: thumbnailRadius,
        visibleWindow,
      });

      if (plan.length === 0) {
        return;
      }

      const batches = createPreviewRequestBatches(plan, selectedPhotoId);
      const requestKeys = plan.map((item) => previewRequestKey(item.photo.id, item.tier));

      void writeAppLog(
        "info",
        "frontend.photo_preview",
        `preview queue started selected=${selectedPhotoId} count=${plan.length} preview=${plan.filter((item) => item.tier === "preview").length} lookahead=${previewLookahead}`,
      );

      // 记下本批的代次，await 之后若已被新选择作废就丢弃结果
      const isCurrent = previewGuardRef.current.begin();
      for (const key of requestKeys) {
        inFlightPreviewIdsRef.current.add(key);
      }

      try {
        for (const batch of batches) {
          if (!isCurrent()) {
            return;
          }

          const photoIds = batch.items.map((item) => item.photo.id);
          const previews = await cachePhotoPreviews(cameraId, photoIds, {
            previewPhotoIds: batch.previewPhotoIds,
          });
          if (!isCurrent()) {
            return;
          }
          for (const preview of previews) {
            if (preview.previewUrl || preview.thumbnailUrl) {
              setCatalog((current) => updatePhotoPreview(current, preview));
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeAppLog(
          "warn",
          "frontend.photo_preview",
          `preview batch failed selected=${selectedPhotoId}: ${message}`,
        );
      } finally {
        for (const key of requestKeys) {
          inFlightPreviewIdsRef.current.delete(key);
        }
      }
    },
    [],
  );

  // 连按方向键时只发最后一次请求，避免每一次按键都叠加一个后端往返。
  // 调度器在 effect 里创建（render 阶段不碰 ref），整个生命周期只建一次。
  const schedulerRef = useRef<PreviewScheduler<PreviewBatchRequest> | null>(null);

  useEffect(() => {
    const scheduler = createPreviewScheduler<PreviewBatchRequest>({
      delayMs: previewDebounceMs,
      onFlush: (request) => flushPreviewBatch(request),
    });
    schedulerRef.current = scheduler;

    return () => {
      schedulerRef.current = null;
      scheduler.dispose();
    };
  }, [flushPreviewBatch]);

  // 切换相机时作废在途批次，防止旧相机的结果写进新目录
  useEffect(() => {
    const guard = previewGuardRef.current;
    const inFlight = inFlightPreviewIdsRef.current;
    guard.invalidate();
    inFlight.clear();
    schedulerRef.current?.cancel();
  }, [activeCamera?.id]);

  const rebuildPreviewQueue = useCallback(
    (
      photos: CameraPhoto[],
      selectedPhotoId: string | null,
      options: { visibleWindow?: PreviewVisibleWindow | null } = {},
    ) => {
      if (!activeCamera || !selectedPhotoId) {
        return;
      }

      schedulerRef.current?.request({
        cameraId: activeCamera.id,
        photos,
        selectedPhotoId,
        visibleWindow: options.visibleWindow ?? null,
      });
    },
    [activeCamera],
  );

  // 先乐观更新本地状态，SDK 写回失败时按错误类型决定保留或回滚
  const updateRating = useCallback(
    async (photo: CameraPhoto, rating: Rating) => {
      setRatingError(null);
      setCatalog((current) => updatePhotoRating(current, photo.id, rating));
      writeLocalRating(window.localStorage, photo.cameraId, photo.id, rating);

      try {
        await setPhotoRating(photo.id, rating);
        setStatus(tr("status.ratingSaved", { rating, fileName: photo.fileName }));
      } catch (error) {
        if (isLocalOnlyRatingError(error)) {
          writeAppLog("warn", "frontend.rating", `rating saved locally for ${photo.id}`);
          setStatus(tr("status.ratingLocalSaved", { rating, fileName: photo.fileName }));
          setRatingError(tr("status.ratingLocalOnly"));
          return;
        }

        setCatalog((current) => updatePhotoRating(current, photo.id, photo.rating));
        writeLocalRating(window.localStorage, photo.cameraId, photo.id, photo.rating);
        const message =
          error instanceof Error ? error.message : tr("status.ratingWriteFailed");
        setRatingError(message);
        writeAppLog("error", "frontend.rating", message);
      }
    },
    [tr],
  );

  const runExport = useCallback(
    async (photoIds: string[], destinationDir: string) => {
      if (!activeCamera || photoIds.length === 0) {
        return;
      }

      if (!destinationDir) {
        setExportStatus("error");
        setStatus(tr("status.exportNeedsDestination"));
        return;
      }

      setExportStatus("exporting");

      try {
        const summary = await exportPhotos({
          cameraId: activeCamera.id,
          destinationDir,
          photoIds,
        });
        setExportStatus(summary.failed > 0 ? "error" : "complete");
        setStatus(
          tr("status.exportComplete", {
            copied: summary.copied,
            failed: summary.failed,
            skipped: summary.skipped,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : tr("status.exportFailed");
        setExportStatus("error");
        setStatus(message);
        writeAppLog("error", "frontend.export", message);
      }
    },
    [activeCamera, tr],
  );

  const updatePickStatus = useCallback((photo: CameraPhoto, status: PickStatus) => {
    setCatalog((current) => updatePhotoPickStatus(current, photo.id, status));
    writeLocalPickStatus(window.localStorage, photo.cameraId, photo.id, status);
    setStatus(
      tr(
        status === "picked"
          ? "status.pickSaved"
          : status === "rejected"
            ? "status.rejectSaved"
            : "status.pickCleared",
        { fileName: photo.fileName },
      ),
    );
  }, [tr]);

  return {
    activeCamera,
    catalog,
    connectionState,
    exportStatus,
    loadCamera,
    ratingError,
    rebuildPreviewQueue,
    runExport,
    scanError,
    setCatalog,
    setStatus,
    status,
    updatePickStatus,
    updateRating,
  };
}
