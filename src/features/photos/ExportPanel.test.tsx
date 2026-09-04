import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExportPanel } from "./ExportPanel";

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
