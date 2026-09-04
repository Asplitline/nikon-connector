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
export function starButtonClass(isActive: boolean, disabled = false): string {
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
    "group relative h-[116px] w-[148px] shrink-0 overflow-hidden rounded-lg border bg-surface text-left max-sm:h-[108px] max-sm:w-[136px]",
    "shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)]",
    interactive,
    "hover:-translate-y-px",
    isSelected
      ? "border-ink shadow-[0_0_0_2px_var(--app-surface),0_0_0_4px_var(--app-ink)]"
      : "border-line hover:border-muted",
  ].join(" ");
}

/** 主预览图:适应窗口时受容器约束,缩放态解除上限并交由 transform 控制 */
export function reviewImageClass(isFitMode: boolean): string {
  return [
    "block h-auto min-h-0 min-w-0 rounded-md object-contain max-sm:max-h-[40vh]",
    "shadow-[0_24px_88px_color-mix(in_oklch,var(--app-ink)_28%,transparent),0_2px_10px_color-mix(in_oklch,var(--app-ink)_18%,transparent)]",
    isFitMode
      ? "max-h-full max-w-full"
      : "max-h-none max-w-none origin-center transition-transform duration-[180ms] ease-[ease]",
  ].join(" ");
}

/** 照片舞台容器:有片时用亮底衬托照片,空态用暗底弱化 */
export function photoStageClass(isReviewReady: boolean): string {
  return [
    "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-6 max-sm:min-h-[42vh] max-sm:p-4",
    isReviewReady ? "bg-stage-lit" : "bg-stage-empty",
  ].join(" ");
}
