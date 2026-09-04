import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppearanceControls,
  ConnectionDiagnosticDialog,
  ConnectionSetup,
  ExportPanel,
  PerformancePanel,
  SettingsPanel,
  ReviewControls,
  ShootingReviewPanel,
} from "./App";
import type { ConnectionDiagnostics } from "./features/photos/connectionDiagnostics";

const diagnostics: ConnectionDiagnostics = {
  blockingStepId: "usb_power",
  primaryAction: { kind: "rescan", label: "Scan again" },
  severity: "attention",
  steps: [
    {
      detail: "Connect the Z6III with a USB-C data cable.",
      id: "usb_power",
      label: "USB and power",
      state: "attention",
    },
    {
      action: { kind: "open_macos_privacy", label: "打开相机隐私设置" },
      detail: "如果相机访问被阻止，请允许 Nikon Connector 访问：系统设置 > 隐私与安全性 > 相机 > Nikon Connector。",
      id: "macos_access",
      label: "macOS access",
      state: "pending",
    },
  ],
  summary: "Waiting for USB camera",
};

describe("connection setup UI", () => {
  it("keeps detailed checks in the modal instead of the main frame", () => {
    const setupMarkup = renderToStaticMarkup(
      <ConnectionSetup
        diagnostics={diagnostics}
        onOpenConnectionCheck={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );
    const dialogMarkup = renderToStaticMarkup(
      <ConnectionDiagnosticDialog
        diagnostics={diagnostics}
        onAction={() => undefined}
        onClose={() => undefined}
        onOpenImageCapture={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    expect(setupMarkup).not.toContain("<ol");
    expect(setupMarkup).toContain("检查连接");
    expect(dialogMarkup).toContain("<ol");
    expect(dialogMarkup).toContain("macOS access");
    expect(dialogMarkup).toContain("系统设置 &gt; 隐私与安全性 &gt; 相机 &gt; Nikon Connector");
    expect(dialogMarkup).toContain("打开相机隐私设置");
  });
});

describe("review controls UI", () => {
  it("shows direct culling filters and sorting controls", () => {
    const markup = renderToStaticMarkup(
      <ReviewControls
        filter="rating_3_plus"
        locale="zh-CN"
        onFilterChange={() => undefined}
        onSortChange={() => undefined}
        sort="rating_desc"
        visibleCount={12}
      />,
    );

    expect(markup).toContain("筛选");
    expect(markup).toContain("3 星以上");
    expect(markup).toContain("排序");
    expect(markup).toContain("评分高到低");
    expect(markup).toContain("12 张可见");
  });
});

describe("export panel UI", () => {
  it("shows selective export modes and destination status", () => {
    const markup = renderToStaticMarkup(
      <ExportPanel
        disabled={false}
        destination="/Users/me/Pictures/Selected"
        exportCount={8}
        exportSizeMb={140.25}
        locale="zh-CN"
        mode="visible"
        onDestinationChange={() => undefined}
        onExport={() => undefined}
        onModeChange={() => undefined}
        status="idle"
      />,
    );

    expect(markup).toContain("精选导出");
    expect(markup).toContain("当前筛选结果");
    expect(markup).toContain("3 星以上");
    expect(markup).toContain("8 张");
    expect(markup).toContain("140.3 MB");
  });
});

describe("shooting review panel UI", () => {
  it("shows the rating summary and format mix", () => {
    const markup = renderToStaticMarkup(
      <ShootingReviewPanel
        locale="zh-CN"
        review={{
          firstCapturedAt: "2026-08-31T07:24:00.000Z",
          formats: { jpg: 2, nef: 1 },
          keepRate: 0.25,
          keepers: 3,
          lastCapturedAt: "2026-08-31T08:44:00.000Z",
          rated: 8,
          total: 12,
          unrated: 4,
        }}
      />,
    );

    expect(markup).toContain("拍摄复盘");
    expect(markup).toContain("精选");
    expect(markup).toContain("25%");
    expect(markup).toContain("JPG 2");
    expect(markup).toContain("NEF 1");
  });
});

describe("performance panel UI", () => {
  it("shows frame rate and occupancy", () => {
    const markup = renderToStaticMarkup(
      <PerformancePanel
        locale="zh-CN"
        metrics={{
          fps: 60,
          memory: {
            jsHeapSizeLimit: 128 * 1024 * 1024,
            totalJSHeapSize: 80 * 1024 * 1024,
            usedJSHeapSize: 42 * 1024 * 1024,
          },
        }}
      />,
    );

    expect(markup).toContain("性能");
    expect(markup).toContain("帧率");
    expect(markup).toContain("60");
    expect(markup).toContain("占用");
    expect(markup).toContain("42.0 / 128.0 MB");
  });
});

describe("appearance controls UI", () => {
  it("shows Chinese light and dark mode choices", () => {
    const markup = renderToStaticMarkup(
      <AppearanceControls
        locale="zh-CN"
        onThemeChange={() => undefined}
        theme="dark"
      />,
    );

    expect(markup).toContain("外观");
    expect(markup).toContain("亮色");
    expect(markup).toContain("暗色");
    expect(markup).toContain('aria-pressed="true"');
  });
});

describe("settings diagnostics UI", () => {
  it("shows app log details and an export action", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        appInfo={{
          changelog: "## Test",
          name: "Nikon Connector",
          updateEndpoint: "https://example.test/latest.json",
          version: "0.1.4",
        }}
        autoUpdateEnabled={false}
        logInfo={{
          exportPath: "/tmp/nikon-connector-diagnostic-log.txt",
          logPath: "/tmp/nikon-connector.log",
          sizeBytes: 2048,
        }}
        logStatus="idle"
        locale="zh-CN"
        onCheckForUpdate={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onInstallUpdate={() => undefined}
        onLocaleChange={() => undefined}
        onThemeChange={() => undefined}
        onToggleAutoUpdate={() => undefined}
        theme="light"
        updateStatus={{ state: "idle", message: "本次会话尚未检查更新。" }}
      />,
    );

    expect(markup).toContain("诊断日志");
    expect(markup).toContain("nikon-connector.log");
    expect(markup).toContain("2.0 KB");
    expect(markup).toContain("导出日志");
  });
});
