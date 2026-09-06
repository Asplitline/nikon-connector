// 照片相关的变体样式:布尔态用函数,枚举态用 Record(见 app/statusStyles.ts)。
// 抽出来是为了让组件的 JSX 只描述结构,不夹带多行 class 拼接。

const interactive =
  "transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-[180ms] ease-[ease] active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/**
 * 评分星按钮的样式。
 *
 * @param isActive 该星是否落在当前评分区间内
 * @param disabled 是否禁用(禁用时取消 hover 反馈并降低不透明度)
 */
export function starButtonClass(
  isActive: boolean,
  disabled = false,
  variant: "panel" | "overlay" = "panel",
): string {
  if (variant === "overlay") {
    return [
      "grid h-8 w-8 place-items-center rounded-md text-[20px]",
      interactive,
      isActive ? "text-star" : "text-on-image/70 hover:text-on-image",
      disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[color-mix(in_oklch,currentColor_12%,transparent)]",
    ].join(" ");
  }

  return [
    "grid h-10 w-10 place-items-center rounded-md text-[20px]",
    interactive,
    isActive ? "text-star" : "text-muted hover:text-ink",
    disabled ? "cursor-not-allowed opacity-50" : "hover:bg-hover",
  ].join(" ");
}

/**
 * 胶片条缩略图按钮的样式。
 *
 * @param isSelected 是否为当前选中项(选中时加双层描边突出)
 */
export function filmstripItemClass(isSelected: boolean): string {
  return [
    "group relative h-[72px] w-[98px] shrink-0 overflow-hidden rounded-md border bg-surface text-left max-sm:h-[68px] max-sm:w-[92px]",
    interactive,
    "hover:-translate-y-px",
    isSelected
      ? "border-focus shadow-[0_0_0_1px_var(--app-focus)]"
      : "border-transparent hover:border-muted",
  ].join(" ");
}

/** 主预览图:适应窗口时受容器约束,缩放态解除上限并交由 transform 控制 */
export function reviewImageClass(isFitMode: boolean): string {
  return [
    "block h-auto min-h-0 min-w-0 touch-none select-none rounded-md object-contain max-sm:max-h-[40vh]",
    "shadow-[0_24px_88px_color-mix(in_oklch,var(--app-ink)_28%,transparent),0_2px_10px_color-mix(in_oklch,var(--app-ink)_18%,transparent)]",
    isFitMode
      ? "max-h-full max-w-full"
      : "max-h-none max-w-none origin-center",
  ].join(" ");
}

/** 照片舞台容器:有片时用亮底衬托照片,空态用暗底弱化 */
export function photoStageClass(isReviewReady: boolean): string {
  return [
    "group relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden px-1.5 py-2 max-sm:min-h-[56vh] max-sm:p-1.5",
    isReviewReady ? "bg-stage-lit" : "bg-stage-empty",
  ].join(" ");
}
