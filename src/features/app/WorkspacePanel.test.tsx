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
  it("keeps culling filters light and centralizes photo count under the filename", () => {
    const markup = renderToStaticMarkup(
      <WorkspacePanel
        activeCamera={{
          connection: "image_capture",
          id: "z6-3",
          model: "Z6III",
          name: "Z6_3",
        }}
        catalogControls={{
          filter: "rating_3_plus",
          onFilterChange: () => undefined,
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
        isRatingDisabled={false}
        isReviewReady
        library={{ photoCount: 5, ratedCount: 3, visibleCount: 2 }}
        locale="zh-CN"
        onNavigatePhoto={() => undefined}
        onMark={() => undefined}
        onOpenConnectionCheck={() => undefined}
        onOpenSettings={() => undefined}
        onPreviewWindowChange={() => undefined}
        onPrimaryDiagnosticAction={() => undefined}
        onRate={() => undefined}
        onSelectPhoto={() => undefined}
        onToggleInspector={() => undefined}
        onZoomAction={() => undefined}
        ratingError={null}
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

    expect(markup).toContain("DSC_0490.JPG");
    expect(markup).toContain("筛选");
    expect(markup).toContain("3 星以上");
    expect(markup).toContain("排序");
    expect(markup).toContain("评分高到低");
    expect(markup).toContain("1 / 1 · 原始 5");
    expect(markup).not.toContain("2 张可见");
    expect(markup).not.toContain("Z6_3 已挂载，包含 5 张照片。");
  });
});
