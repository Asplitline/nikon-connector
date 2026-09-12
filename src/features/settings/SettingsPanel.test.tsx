import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppearanceControls } from "./AppearanceControls";
import { SettingsPanel } from "./SettingsPanel";
import { parseChangelog } from "./releaseNotes";

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
        onClearLogs={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onRevealExportLog={() => undefined}
        onRevealLog={() => undefined}
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
    expect(markup).toContain("清空日志");
    expect(markup).toContain("在 Finder 中显示日志文件");
    expect(markup).not.toContain(">/tmp/nikon-connector.log<");
    expect(markup).not.toContain(">/tmp/nikon-connector-diagnostic-log.txt<");
  });

  it("groups settings behind a left tab rail", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        appInfo={{
          changelog: "## v0.1.4\n- Improve toolbar",
          name: "Nikon Connector",
          updateEndpoint: "https://example.test/latest.json",
          version: "0.1.4",
        }}
        autoUpdateEnabled={false}
        logInfo={null}
        logStatus="idle"
        locale="zh-CN"
        onCheckForUpdate={() => undefined}
        onClearLogs={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onRevealExportLog={() => undefined}
        onRevealLog={() => undefined}
        onInstallUpdate={() => undefined}
        onLocaleChange={() => undefined}
        onThemeChange={() => undefined}
        onToggleAutoUpdate={() => undefined}
        theme="light"
        updateStatus={{ state: "idle", message: "本次会话尚未检查更新。" }}
      />,
    );

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain("通用");
    expect(markup).toContain("应用与更新");
    expect(markup).toContain("诊断");
    expect(markup).toContain("发布日志");
  });

  it("keeps the dialog height independent from tab content", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        appInfo={{
          changelog: "## v0.1.4\n- Improve toolbar",
          name: "Nikon Connector",
          updateEndpoint: "https://example.test/latest.json",
          version: "0.1.4",
        }}
        autoUpdateEnabled={false}
        logInfo={null}
        logStatus="idle"
        locale="zh-CN"
        onCheckForUpdate={() => undefined}
        onClearLogs={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onRevealExportLog={() => undefined}
        onRevealLog={() => undefined}
        onInstallUpdate={() => undefined}
        onLocaleChange={() => undefined}
        onThemeChange={() => undefined}
        onToggleAutoUpdate={() => undefined}
        theme="light"
        updateStatus={{ state: "idle", message: "本次会话尚未检查更新。" }}
      />,
    );

    expect(markup).toContain("h-[min(720px,calc(100vh-48px))]");
    expect(markup).toContain("overflow-y-auto");
  });

  it("renders URL and file paths as openable setting values", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        appInfo={{
          changelog: "## v0.1.4\n- Improve toolbar",
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
        onClearLogs={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onRevealExportLog={() => undefined}
        onRevealLog={() => undefined}
        onInstallUpdate={() => undefined}
        onLocaleChange={() => undefined}
        onThemeChange={() => undefined}
        onToggleAutoUpdate={() => undefined}
        theme="light"
        updateStatus={{ state: "idle", message: "本次会话尚未检查更新。" }}
      />,
    );

    expect(markup).toContain('title="https://example.test/latest.json"');
    expect(markup).toContain('aria-label="在 Finder 中显示日志文件"');
    expect(markup).toContain('aria-label="在 Finder 中显示导出日志"');
    expect(markup).not.toContain('<span class="shrink-0 text-ui-xs font-ui-700 text-muted">打开</span>');
  });

  it("keeps loading values as plain text", () => {
    const markup = renderToStaticMarkup(
      <SettingsPanel
        appInfo={null}
        autoUpdateEnabled={false}
        logInfo={null}
        logStatus="idle"
        locale="zh-CN"
        onCheckForUpdate={() => undefined}
        onClearLogs={() => undefined}
        onClose={() => undefined}
        onExportLogs={() => undefined}
        onRevealExportLog={() => undefined}
        onRevealLog={() => undefined}
        onInstallUpdate={() => undefined}
        onLocaleChange={() => undefined}
        onThemeChange={() => undefined}
        onToggleAutoUpdate={() => undefined}
        theme="light"
        updateStatus={{ state: "idle", message: "本次会话尚未检查更新。" }}
      />,
    );

    expect(markup).not.toContain('title="加载中..."');
  });

  it("parses release notes into readable sections", () => {
    expect(
      parseChangelog("## 0.1.6\n- 优化设置弹窗\n- 改进发布日志\n\n## 0.1.5\n修复连接提示"),
    ).toEqual([
      {
        body: "",
        items: ["优化设置弹窗", "改进发布日志"],
        title: "0.1.6",
      },
      {
        body: "修复连接提示",
        items: [],
        title: "0.1.5",
      },
    ]);
  });

  it("skips an empty generic changelog heading", () => {
    expect(parseChangelog("# Changelog\n\n## [Unreleased]\n- Desktop updates")).toEqual([
      {
        body: "",
        items: ["Desktop updates"],
        title: "未发布",
      },
    ]);
  });

  it("localizes common changelog section headings", () => {
    expect(parseChangelog("## [Unreleased]\n\n### Added\n- Release notes\n\n### Fixed\n- Update check")).toEqual([
      {
        body: "",
        items: [],
        title: "未发布",
      },
      {
        body: "",
        items: ["Release notes"],
        title: "新增",
      },
      {
        body: "",
        items: ["Update check"],
        title: "修复",
      },
    ]);
  });
});
