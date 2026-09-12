import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewControls } from "./ReviewControls";

describe("review controls UI", () => {
  it("shows sorting controls without rating filters", () => {
    const markup = renderToStaticMarkup(
      <ReviewControls
        locale="zh-CN"
        onSortChange={() => undefined}
        sort="rating_desc"
        visibleCount={12}
      />,
    );

    expect(markup).toContain("排序");
    expect(markup).toContain("评分高到低");
    expect(markup).toContain("12 张可见");
    expect(markup).not.toContain("筛选");
    expect(markup).not.toContain("3 星以上");
  });
});
