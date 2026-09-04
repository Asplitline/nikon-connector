import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Locale, t } from "../../i18n";
import { writeAppLog } from "../../lib/appApi";
import {
  cachePhotoPreviews,
  exportPhotos,
  listCameras,
  listPhotos,
  setPhotoRating,
} from "../../lib/cameraApi";
import { createSingleFlight } from "../../lib/singleFlight";
import {
  createPhotoCatalog,
  updatePhotoPreview,
  updatePhotoRating,
} from "../photos/catalog";
import {
  applyLocalRatings,
  isLocalOnlyRatingError,
  readLocalRatings,
  writeLocalRating,
} from "../photos/localRatings";
import { createPreviewPlan } from "../photos/previewQueue";
import {
  createGenerationGuard,
  createPreviewScheduler,
  type PreviewScheduler,
} from "../photos/previewScheduler";
import type {
  CameraConnectionState,
  CameraDevice,
  CameraPhoto,
  PhotoCatalogState,
  Rating,
} from "../photos/types";
import type { ExportStatus } from "./uiTypes";

// 一批预览请求的输入；相机 id 随请求带上，避免切相机后用到旧闭包
interface PreviewBatchRequest {
  cameraId: string;
  photos: CameraPhoto[];
  selectedPhotoId: string;
}

// 防抖窗口：略小于连续按键间隔，既能合并连按又不让单次换图有明显延迟
const previewDebounceMs = 140;

export interface CameraSession {
  activeCamera: CameraDevice | null;
  catalog: PhotoCatalogState;
  connectionState: CameraConnectionState;
  exportStatus: ExportStatus;
  loadCamera: () => Promise<void>;
  ratingError: string | null;
  rebuildPreviewQueue: (photos: CameraPhoto[], selectedPhotoId: string | null) => void;
  runExport: (photoIds: string[], destinationDir: string) => Promise<void>;
  scanError: string | null;
  setCatalog: React.Dispatch<React.SetStateAction<PhotoCatalogState>>;
  setStatus: (status: string) => void;
  status: string;
  updateRating: (photo: CameraPhoto, rating: Rating) => Promise<void>;
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
      const nextPhotos = applyLocalRatings(
        await listPhotos(nextCamera.id),
        readLocalRatings(window.localStorage, nextCamera.id),
      );
      setActiveCamera(nextCamera);
      setCatalog(createPhotoCatalog(nextPhotos));
      if (nextCamera.connection === "mock") {
        setConnectionState("not_connected");
        setStatus(tr("status.demo"));
        return;
      }
      setConnectionState("connected");
      setStatus(
        tr("status.mountedPhotos", {
          camera: nextCamera.name,
          count: nextPhotos.length,
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

  const loadCamera = useMemo(
    () => createSingleFlight(runCameraLoad),
    [runCameraLoad],
  );

  useEffect(() => {
    void Promise.resolve().then(loadCamera);
  }, [loadCamera]);

  // 真正发起一批预览请求。经调度器防抖后调用，同一时刻只会有一批在途。
  const flushPreviewBatch = useCallback(
    async ({ cameraId, photos, selectedPhotoId }: PreviewBatchRequest) => {
      const plan = createPreviewPlan({
        photos,
        selectedPhotoId,
        inFlightPhotoIds: inFlightPreviewIdsRef.current,
        radius: 2,
      });

      if (plan.length === 0) {
        return;
      }

      const photoIds = plan.map((item) => item.photo.id);
      const previewPhotoIds = plan
        .filter((item) => item.tier === "preview")
        .map((item) => item.photo.id);

      void writeAppLog(
        "info",
        "frontend.photo_preview",
        `preview queue started selected=${selectedPhotoId} count=${photoIds.length}`,
      );

      // 记下本批的代次，await 之后若已被新选择作废就丢弃结果
      const isCurrent = previewGuardRef.current.begin();
      for (const photoId of photoIds) {
        inFlightPreviewIdsRef.current.add(photoId);
      }

      try {
        const previews = await cachePhotoPreviews(cameraId, photoIds, { previewPhotoIds });
        if (!isCurrent()) {
          return;
        }
        for (const preview of previews) {
          if (preview.previewUrl || preview.thumbnailUrl) {
            setCatalog((current) => updatePhotoPreview(current, preview));
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
        for (const photoId of photoIds) {
          inFlightPreviewIdsRef.current.delete(photoId);
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
    (photos: CameraPhoto[], selectedPhotoId: string | null) => {
      if (!activeCamera || !selectedPhotoId) {
        return;
      }

      schedulerRef.current?.request({
        cameraId: activeCamera.id,
        photos,
        selectedPhotoId,
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
    updateRating,
  };
}
