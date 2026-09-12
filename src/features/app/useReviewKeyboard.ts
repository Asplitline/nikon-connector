import { useEffect, useRef } from "react";
import {
  getCatalogView,
  selectPhotoByOffset,
  selectPhotoEdge,
  type PhotoCatalogFilter,
  type PhotoCatalogSort,
} from "../photos/catalog";
import {
  createPhotoReviewShortcutResolver,
  shouldIgnorePhotoReviewShortcut,
} from "../photos/keyboard";
import type {
  CameraConnectionState,
  CameraPhoto,
  PickStatus,
  PhotoCatalogState,
  Rating,
} from "../photos/types";
import { applyZoomAction, createFitZoomState, type PhotoZoomState } from "../photos/zoom";

// 照片审阅快捷键：方向键/Home/End 换图，数字键评级，+ - F Z 控制缩放
export function useReviewKeyboard({
  connectionState,
  filter,
  onMark,
  onOpenComment,
  onRate,
  onToggleInspector,
  selectedPhoto,
  setCatalog,
  setZoom,
  sort,
}: {
  connectionState: CameraConnectionState;
  filter: PhotoCatalogFilter;
  onMark: (photo: CameraPhoto, status: PickStatus) => void;
  onOpenComment: () => void;
  onRate: (photo: CameraPhoto, rating: Rating) => void;
  onToggleInspector: () => void;
  selectedPhoto: CameraPhoto | undefined;
  setCatalog: React.Dispatch<React.SetStateAction<PhotoCatalogState>>;
  setZoom: React.Dispatch<React.SetStateAction<PhotoZoomState>>;
  sort: PhotoCatalogSort;
}) {
  const resolveShortcutRef = useRef(createPhotoReviewShortcutResolver());

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnorePhotoReviewShortcut(event.target)) {
        return;
      }

      const shortcut = resolveShortcutRef.current(event.key);

      if (!shortcut) {
        return;
      }

      if (shortcut.type === "ratePrefix") {
        event.preventDefault();
        return;
      }

      // 换图始终按当前筛选/排序后的可见列表移动，而不是全量目录
      if (shortcut.type === "move" || shortcut.type === "edge") {
        event.preventDefault();
        setZoom(createFitZoomState());
        setCatalog((current) => {
          const visible = getCatalogView(current, { filter, sort });
          const next =
            shortcut.type === "move"
              ? selectPhotoByOffset(visible, shortcut.offset)
              : selectPhotoEdge(visible, shortcut.edge);

          return { ...current, selectedPhotoId: next.selectedPhotoId };
        });
        return;
      }

      if (shortcut.type === "rate" && connectionState === "connected" && selectedPhoto) {
        event.preventDefault();
        onRate(selectedPhoto, shortcut.rating);
        return;
      }

      if (shortcut.type === "mark" && connectionState === "connected" && selectedPhoto) {
        event.preventDefault();
        onMark(
          selectedPhoto,
          selectedPhoto.pickStatus === shortcut.status ? "none" : shortcut.status,
        );
        return;
      }

      if (shortcut.type === "inspector" && selectedPhoto) {
        event.preventDefault();
        onToggleInspector();
        return;
      }

      if (shortcut.type === "comment" && selectedPhoto) {
        event.preventDefault();
        onOpenComment();
        return;
      }

      if (shortcut.type === "zoom" && selectedPhoto) {
        event.preventDefault();
        setZoom((current) => applyZoomAction(current, shortcut.action));
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    connectionState,
    filter,
    onMark,
    onOpenComment,
    onRate,
    onToggleInspector,
    selectedPhoto,
    setCatalog,
    setZoom,
    sort,
  ]);
}
