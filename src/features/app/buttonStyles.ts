// 按钮样式集中在此，替代原先的 .primary-button / .secondary-button CSS 规则。
// compact 是尺寸变体（窄内边距 + 撑满宽度），与主/次配色正交。

type ButtonVariant = "primary" | "secondary";

const base =
  "min-h-10 rounded-lg px-3.5 text-ui-4xl font-ui-750 transition-[background-color,border-color,color,opacity,transform] duration-[180ms] ease-[ease] hover:not-disabled:-translate-y-px disabled:cursor-not-allowed disabled:opacity-45";

const compactSize = "min-h-[34px] w-full px-2.5 text-ui-lg";

const tone: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-on-ink disabled:border disabled:border-line disabled:bg-surface disabled:text-muted disabled:opacity-100",
  secondary: "border border-line bg-surface text-ink",
};

export function buttonClass(
  variant: ButtonVariant,
  options: { compact?: boolean; extra?: string } = {},
): string {
  const parts = [base, tone[variant]];
  if (options.compact) parts.push(compactSize);
  if (options.extra) parts.push(options.extra);
  return parts.join(" ");
}

// 方形图标按钮（缩放 +/-、弹窗关闭），颜色继承父级
export const iconButtonClass =
  "grid min-h-9 min-w-9 place-items-center rounded-[7px] text-inherit transition-[background-color,color,transform] duration-[180ms] ease-[ease] hover:bg-[color-mix(in_oklch,currentColor_10%,transparent)] active:translate-y-px";

// 缩放工具条里的文字按钮（如「适应」「100%」）
export const zoomTextButtonClass =
  "min-h-9 rounded-[7px] px-2.5 text-ui-md font-ui-700 text-inherit transition-[background-color,transform] duration-[180ms] ease-[ease] hover:bg-[color-mix(in_oklch,currentColor_10%,transparent)]";

// 分段控件容器
export const segmentedControlClass =
  "inline-grid auto-cols-[minmax(86px,1fr)] grid-flow-col gap-[3px] rounded-lg border border-line bg-surface p-[3px]";

// 分段控件内的按钮；选中态用 aria-pressed 驱动，避免额外状态类
export const segmentedButtonClass =
  "min-h-[34px] rounded-md px-3 text-ui-2xl font-ui-720 text-muted transition-[background-color,color,transform] duration-[180ms] ease-[ease] hover:bg-hover hover:text-ink aria-pressed:bg-ink aria-pressed:text-surface aria-pressed:hover:bg-ink aria-pressed:hover:text-surface";
