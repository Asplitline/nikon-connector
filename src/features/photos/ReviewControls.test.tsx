import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewControls } from "./ReviewControls";

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
