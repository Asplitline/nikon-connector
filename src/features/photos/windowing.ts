// 横向虚拟化的窗口计算：只渲染可视区 ± overscan，避免上千张照片全量进 DOM。
// 纯函数，不碰 DOM，便于在 node 环境单测。

export interface WindowRangeOptions {
  // 每项之间的间距（px）
  gap?: number;
  // 单项宽度（px），不含 gap
  itemWidth: number;
  // 可视区两侧额外多渲染的项数，滚动时不至于露白
  overscan?: number;
  scrollLeft: number;
  total: number;
  viewportWidth: number;
}

export interface WindowRange {
  // 末项之后需要补的占位宽度（px）
  endSpacer: number;
  // [startIndex, endIndex) 半开区间
  endIndex: number;
  startIndex: number;
  // 首项之前需要补的占位宽度（px）
  startSpacer: number;
}

const defaultOverscan = 4;

export function computeWindowRange({
  gap = 0,
  itemWidth,
  overscan = defaultOverscan,
  scrollLeft,
  total,
  viewportWidth,
}: WindowRangeOptions): WindowRange {
  const stride = itemWidth + gap;

  // 宽度非法时退化为「全量渲染」，宁可慢也不要白屏
  if (total <= 0 || stride <= 0) {
    return { endIndex: total > 0 ? total : 0, endSpacer: 0, startIndex: 0, startSpacer: 0 };
  }

  const safeScrollLeft = Math.max(0, scrollLeft);
  const firstVisible = Math.floor(safeScrollLeft / stride);
  // 可视区宽度非正时至少渲染一项，否则选中项可能不可见
  const visibleCount = Math.max(1, Math.ceil(Math.max(0, viewportWidth) / stride) + 1);

  const startIndex = clamp(firstVisible - overscan, 0, Math.max(0, total - 1));
  const endIndex = clamp(firstVisible + visibleCount + overscan, startIndex + 1, total);

  // 占位宽度按 stride 整数倍算：首/尾占位都紧邻已渲染项，各自需要保留自己的
  // 那个 gap；只有整条内容的最末尾不带 gap，而那一份由渲染项自身承担
  return {
    endIndex,
    endSpacer: Math.max(0, (total - endIndex) * stride),
    startIndex,
    startSpacer: Math.max(0, startIndex * stride),
  };
}

// 让指定项进入窗口所需的滚动位置，用于键盘换图时同步胶片条
export function scrollOffsetForIndex({
  gap = 0,
  index,
  itemWidth,
  scrollLeft,
  viewportWidth,
}: {
  gap?: number;
  index: number;
  itemWidth: number;
  scrollLeft: number;
  viewportWidth: number;
}): number {
  const stride = itemWidth + gap;
  if (stride <= 0) {
    return Math.max(0, scrollLeft);
  }

  const safeIndex = Math.max(0, index);
  const itemStart = safeIndex * stride;
  const itemEnd = itemStart + itemWidth;
  const viewStart = Math.max(0, scrollLeft);
  const viewEnd = viewStart + Math.max(0, viewportWidth);

  if (itemStart < viewStart) {
    return itemStart;
  }
  if (itemEnd > viewEnd) {
    return Math.max(0, itemEnd - Math.max(0, viewportWidth));
  }
  return viewStart;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
