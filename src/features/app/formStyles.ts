// 表单控件样式。原 CSS 靠 .control-field input/select 后代选择器统一设置，
// 这里改为显式类：外层用 fieldLabelClass，input/select 用 fieldInputClass。

// 标签容器：栅格排布 + 说明文字配色
export const fieldLabelClass =
  "grid gap-[7px] text-ui-sm font-ui-760 text-muted";

// 输入框/下拉框：尺寸、描边、配色、禁用与焦点态
export const fieldInputClass =
  "min-h-[38px] w-full rounded-lg border border-line bg-surface px-2.5 font-[inherit] text-ui-3xl font-ui-680 text-ink " +
  "placeholder:text-[color-mix(in_oklch,var(--app-muted)_68%,transparent)] " +
  "disabled:cursor-not-allowed disabled:opacity-55 " +
  "focus:outline-none focus-visible:shadow-[0_0_0_2px_var(--app-focus)]";
