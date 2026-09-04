import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceControls } from "./AppearanceControls";
import { SettingsPanel } from "./SettingsPanel";

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
