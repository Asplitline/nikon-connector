import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createConnectionDiagnostics } from "../photos/connectionDiagnostics";
import type { CameraPhoto } from "../photos/types";
import { WorkspacePanel } from "./WorkspacePanel";
import { t } from "../../i18n";

const photo: CameraPhoto = {
  cameraId: "z6-3",
  capturedAt: "2026-08-31T07:24:00.000Z",
  fileName: "DSC_0490.JPG",
  fileType: "jpg",
  height: 4024,
  id: "dsc-0490",
  previewUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  rating: 4,
  sizeMb: 18.4,
  thumbnailUrl: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
  width: 6048,
};

describe("WorkspacePanel", () => {
  function renderReviewWorkspace({
    initialReviewMode,
    initialShortcutsVisible = false,
    ratingError = null,
  }: {
    initialReviewMode?: "review" | "view";
    initialShortcutsVisible?: boolean;
    ratingError?: string | null;
  } = {}) {
    return renderToStaticMarkup(
      <WorkspacePanel
        activeCamera={{
          connection: "image_capture",
          id: "z6-3",
          model: "Z6III",
          name: "Z6_3",
        }}
        catalogControls={{
          onSortChange: () => undefined,
          sort: "rating_desc",
        }}
        connectionLabel="Z6_3"
        connectionState="connected"
        diagnostics={createConnectionDiagnostics({
          camera: {
            connection: "image_capture",
            id: "z6-3",
            model: "Z6III",
            name: "Z6_3",
          },
          connectionState: "connected",
          locale: "zh-CN",
          photoCount: 5,
          scanError: null,
        })}
        exportControls={{
          destination: "",
          mode: "current",
          onDestinationChange: () => undefined,
          onExport: () => undefined,
          onModeChange: () => undefined,
          selection: { count: 1, photoIds: [photo.id], sizeMb: photo.sizeMb },
          status: "idle",
        }}
        inspectorOpen={false}
        initialReviewMode={initialReviewMode}
        initialShortcutsVisible={initialShortcutsVisible}
        isRatingDisabled={false}
        isReviewReady
        library={{ photoCount: 5, ratedCount: 3, visibleCount: 2 }}
        locale="zh-CN"
        onNavigatePhoto={() => undefined}
        onMark={() => undefined}
        onDiagnosticAction={() => undefined}
        onOpenConnectionCheck={() => undefined}
        onOpenSettings={() => undefined}
        onPreviewWindowChange={() => undefined}
        onPrimaryDiagnosticAction={() => undefined}
        onRate={() => undefined}
        onSelectPhoto={() => undefined}
        onToggleInspector={() => undefined}
        onZoomAction={() => undefined}
        ratingError={ratingError}
        selection={{
          catalogView: {
            photos: [photo],
            selectedPhotoId: photo.id,
          },
          index: 1,
          photo,
        }}
        shootingReview={{
          firstCapturedAt: photo.capturedAt,
          formats: { jpg: 5 },
          keepRate: 0.2,
          keepers: 1,
          lastCapturedAt: photo.capturedAt,
          rated: 3,
          total: 5,
          unrated: 2,
        }}
        status="Z6_3 已挂载，包含 5 张照片。"
        tr={(key, values) => t(key, values, "zh-CN")}
        zoom={{ mode: "fit", scale: 1 }}
      />,
    );
  }

  it("keeps review controls light and collapses the filmstrip by default", () => {
    const markup = renderReviewWorkspace();

    expect(markup).toContain("DSC_0490.JPG");
    expect(markup).toContain("排序");
    expect(markup).toContain("评分高到低");
    expect(markup).toContain("1 / 1 · 原始 5");
    expect(markup).toContain('aria-label="展开缩略图"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('aria-label="设备"');
    expect(markup).toContain("grid h-8 w-8 shrink-0");
    expect(markup).not.toContain("pointer-events-none absolute inset-x-0");
    expect(markup).not.toContain(">展开缩略图</button>");
    expect(markup).toContain("grid-rows-[64px_minmax(0,1fr)]");
    expect(markup).not.toContain("grid-rows-[64px_minmax(0,1fr)_88px]");
    expect(markup).not.toContain("data-filmstrip-item");
    expect(markup).not.toContain("2 张可见");
    expect(markup).not.toContain("5 张 · 已评 3 · 精选 1");
    expect(markup).not.toContain("Z6_3 已挂载，包含 5 张照片。");
    expect(markup).not.toContain("筛选");
    expect(markup).not.toContain("3 星以上");
    expect(markup).not.toContain('data-shortcut-hint="true"');
  });

  it("floats rating feedback over the workspace without adding a layout row", () => {
    const markup = renderReviewWorkspace({
      ratingError: "评级写回失败。相机可能不支持此操作。",
    });

    expect(markup).toContain("评级写回失败。相机可能不支持此操作。");
    expect(markup).toContain('role="status"');
    expect(markup).toContain("pointer-events-none absolute inset-x-4");
    expect(markup).toContain("bottom-4");
    expect(markup).toContain("grid-rows-[64px_minmax(0,1fr)]");
    expect(markup).not.toContain("grid-rows-[64px_minmax(0,1fr)_34px]");
  });

  it("can start in immersive view mode with review chrome hidden", () => {
    const markup = renderReviewWorkspace({ initialReviewMode: "view" });

    expect(markup).toContain("DSC_0490.JPG");
    expect(markup).toContain('aria-label="退出沉浸查看"');
    expect(markup).toContain('aria-label="当前照片 1 / 1"');
    expect(markup).toContain('data-view-mode-rail="true"');
    expect(markup).toContain("lucide-minimize-2");
    expect(markup).not.toContain("lucide-eye");
    expect(markup).toContain("grid-rows-[32px_minmax(0,1fr)]");
    expect(markup).toContain("row-start-2");
    expect(markup).not.toContain("left-1/2 top-4");
    expect(markup).not.toContain("筛选");
    expect(markup).not.toContain("3 星以上");
    expect(markup).not.toContain("排序");
    expect(markup).not.toContain('aria-label="详情"');
    expect(markup).not.toContain("导出 1 张");
    expect(markup).not.toContain('aria-label="展开缩略图"');
    expect(markup).not.toContain("lucide-star");
    expect(markup).not.toContain("lucide-minus");
    expect(markup).not.toContain('aria-label="下一张照片"');
    expect(markup).not.toContain('aria-label="上一张照片"');
  });

  it("reveals available shortcuts when shortcut hints are visible", () => {
    const markup = renderReviewWorkspace({ initialShortcutsVisible: true });

    expect(markup).toContain('data-shortcut-hint="true"');
    expect(markup).toContain(">I</kbd>");
    expect(markup).toContain(">V</kbd>");
    expect(markup).toContain(">←</kbd>");
    expect(markup).toContain(">→</kbd>");
    expect(markup).toContain(">+</kbd>");
    expect(markup).toContain(">-</kbd>");
    expect(markup).toContain(">F</kbd>");
    expect(markup).toContain(">1-5</kbd>");
    expect(markup).toContain(">P</kbd>");
    expect(markup).toContain(">X</kbd>");
  });

  it("shows exit shortcuts in immersive view mode when shortcut hints are visible", () => {
    const markup = renderReviewWorkspace({
      initialReviewMode: "view",
      initialShortcutsVisible: true,
    });

    expect(markup).toContain('data-shortcut-hint="true"');
    expect(markup).toContain(">Esc</kbd>");
    expect(markup).toContain(">V</kbd>");
    expect(markup).not.toContain(">1-5</kbd>");
  });
});
