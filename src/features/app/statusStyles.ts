import type { ExportStatus, UpdateStatus } from "./uiTypes";
import type {
  ConnectionDiagnostics,
  DiagnosticStepState,
} from "../photos/connectionDiagnostics";

// 状态徽标的配色由运行时数据决定，Tailwind 变体是静态的，
// 因此把「状态 → 工具类」的映射放在 TS 里，替代原先的 .x.state CSS 规则。

// 徽标外形（尺寸/圆角/字号），各状态共用
const badgeBase =
  "shrink-0 rounded-full px-2 py-[5px] text-ui-2xs font-ui-780 leading-none whitespace-nowrap";

const statusTone: Record<ExportStatus, string> = {
  idle: "bg-info-bg text-info",
  exporting: "bg-warn-bg text-warn",
  complete: "bg-ready-soft text-ready-strong",
  error: "bg-danger-bg text-danger",
};

export function exportStatusClass(status: ExportStatus): string {
  return `${badgeBase} ${statusTone[status]}`;
}

type Severity = ConnectionDiagnostics["severity"];

const severityTone: Record<Severity, string> = {
  ready: "bg-ready-soft text-ready-strong",
  checking: "bg-info-bg text-info",
  demo: "bg-info-bg text-info",
  attention: "bg-warn-bg text-warn",
};

// 侧栏概要徽标：可换行，故用 wrap-anywhere 而非 whitespace-nowrap
export function diagnosticSummaryClass(severity: Severity): string {
  return `min-h-6 max-w-full rounded-full px-2 py-[5px] text-ui-2xs font-ui-750 leading-[1.15] wrap-anywhere ${severityTone[severity]}`;
}

// 连接引导页的大号状态标签
export function connectionKickerClass(severity: Severity): string {
  return `inline-flex min-h-7 items-center rounded-full px-2.5 text-ui-sm font-ui-800 ${severityTone[severity]}`;
}

// 更新提示条：仅 available / error 有专属描边配色，其余沿用默认
const updateTone: Record<UpdateStatus["state"], string> = {
  idle: "border-line text-muted",
  checking: "border-line text-muted",
  installing: "border-line text-muted",
  available: "border-ready-line text-ink",
  error: "border-danger-line bg-danger-bg text-danger",
};

export function updateMessageClass(state: UpdateStatus["state"]): string {
  return `mt-3.5 rounded-lg border bg-surface p-3 text-ui-6xl leading-[1.55] ${updateTone[state]}`;
}

// 诊断步骤：外框描边/底色、左侧圆形标记、右侧状态字，三者配色随 state 联动，
// 原先靠 .diagnostic-step.complete .diagnostic-marker 这类后代选择器串起来。
const stepShell: Record<DiagnosticStepState, string> = {
  complete: "border-[color-mix(in_oklch,var(--app-ready)_30%,var(--app-line))]",
  checking:
    "border-[color-mix(in_oklch,var(--app-info)_34%,var(--app-line))] bg-info-bg",
  attention:
    "border-[color-mix(in_oklch,var(--app-warn)_42%,var(--app-line))] bg-warn-bg",
  pending: "border-line",
  unavailable: "border-line",
};

export function diagnosticStepClass(state: DiagnosticStepState): string {
  return `grid grid-cols-[22px_minmax(0,1fr)] gap-[9px] rounded-lg border bg-[color-mix(in_oklch,var(--app-surface)_72%,transparent)] p-[9px] ${stepShell[state]}`;
}

const markerTone: Record<DiagnosticStepState, string> = {
  complete: "bg-ready text-surface",
  checking: "bg-info text-surface",
  attention: "bg-warn text-surface",
  pending: "bg-line text-muted",
  unavailable:
    "bg-[color-mix(in_oklch,var(--app-muted)_22%,var(--app-line))] text-muted",
};

export function diagnosticMarkerClass(state: DiagnosticStepState): string {
  return `grid size-[22px] place-items-center rounded-full text-ui-2xs font-ui-850 leading-none ${markerTone[state]}`;
}

const stateTone: Record<DiagnosticStepState, string> = {
  complete: "text-[color-mix(in_oklch,var(--app-ready)_70%,var(--app-ink))]",
  checking: "text-muted",
  attention: "text-warn",
  pending: "text-muted",
  unavailable: "text-muted",
};

export function diagnosticStateClass(state: DiagnosticStepState): string {
  return `shrink-0 text-ui-3xs font-ui-760 leading-none uppercase ${stateTone[state]}`;
}

// 步骤内的行动按钮(如「打开图像捕捉」)
export const diagnosticActionClass =
  "min-h-7 mt-2 rounded-[7px] border border-[color-mix(in_oklch,var(--app-warn)_34%,var(--app-line))] bg-surface px-[9px] text-ui-xs font-ui-780 text-ink transition-[background-color,border-color,transform] duration-[180ms] ease-[ease] hover:bg-hover active:translate-y-px";
