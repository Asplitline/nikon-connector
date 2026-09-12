import {
  AlertTriangle,
  Circle,
  CircleCheck,
  CircleMinus,
  LoaderCircle,
  X,
} from "lucide-react";
import { defaultLocale, type Locale, t } from "../../i18n";
import type {
  ConnectionDiagnostics,
  ConnectionDiagnosticStep,
  DiagnosticActionKind,
} from "./connectionDiagnostics";
import { formatDiagnosticState } from "./labels";
import { buttonClass, iconButtonClass } from "../app/buttonStyles";
import {
  diagnosticActionClass,
  diagnosticMarkerClass,
  diagnosticStateClass,
  diagnosticStepClass,
} from "../app/statusStyles";

export function ConnectionDiagnosticDialog({
  diagnostics,
  locale = defaultLocale,
  onAction,
  onClose,
  onOpenImageCapture,
  onPrimaryAction,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onAction: (kind: DiagnosticActionKind) => void;
  onClose: () => void;
  onOpenImageCapture: () => void;
  onPrimaryAction: () => void;
}) {
  return (
    <div className="bg-[color-mix(in_oklch,var(--app-canvas)_74%,transparent)] backdrop-blur-[2px] backdrop-saturate-[0.96] fixed inset-0 z-20 grid place-items-center px-5 py-6">
      <button
        aria-label={t("connection.closeCheck", undefined, locale)}
        className="cursor-default absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label={t("connection.check", undefined, locale)}
        aria-modal="true"
        className="shadow-[0_28px_90px_color-mix(in_oklch,var(--app-ink)_28%,transparent),0_2px_8px_color-mix(in_oklch,var(--app-ink)_12%,transparent)] relative z-10 flex max-h-full w-[680px] max-w-full flex-col overflow-hidden rounded-xl border border-line bg-panel"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="section-label">{t("connection.check", undefined, locale)}</p>
            <h2 className="mt-2 text-xl font-semibold">{diagnostics.summary}</h2>
          </div>
          <button
            aria-label={t("connection.closeCheck", undefined, locale)}
            className={iconButtonClass}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <ol className="grid gap-[7px] m-0 p-0">
            {diagnostics.steps.map((step) => (
              <DiagnosticStepRow
                key={step.id}
                locale={locale}
                onAction={onAction}
                step={step}
              />
            ))}
          </ol>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
          <button className={buttonClass("secondary")} onClick={onOpenImageCapture} type="button">
            {t("connection.imageCapture", undefined, locale)}
          </button>
          <button
            className={buttonClass("primary")}
            disabled={diagnostics.primaryAction.kind === "none"}
            onClick={onPrimaryAction}
            type="button"
          >
            {diagnostics.primaryAction.label}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function DiagnosticStepRow({
  compact = false,
  locale = defaultLocale,
  onAction,
  step,
}: {
  compact?: boolean;
  locale?: Locale;
  onAction?: (kind: DiagnosticActionKind) => void;
  step: ConnectionDiagnosticStep;
}) {
  const labelClass = compact
    ? "min-w-0 wrap-anywhere text-ui-2xl font-ui-760 leading-[1.2]"
    : "min-w-0 wrap-anywhere text-ui-3xl font-ui-760 leading-[1.2]";
  const detailClass = compact
    ? "mt-0.5 block text-ui-sm leading-[1.4] wrap-anywhere text-muted"
    : "mt-1 block text-ui-lg leading-[1.45] wrap-anywhere text-muted";

  return (
    <li className={diagnosticStepClass(step.state, compact)}>
      <span aria-hidden="true" className={diagnosticMarkerClass(step.state)}>
        <DiagnosticStateIcon state={step.state} />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-baseline justify-between gap-2">
          <span className={labelClass}>{step.label}</span>
          <span className={diagnosticStateClass(step.state)}>
            {formatDiagnosticState(step.state, locale)}
          </span>
        </span>
        <span className={detailClass}>{step.detail}</span>
        {step.action && onAction ? (
          <button
            className={diagnosticActionClass}
            onClick={() => onAction(step.action?.kind ?? "none")}
            type="button"
          >
            {step.action.label}
          </button>
        ) : null}
      </span>
    </li>
  );
}

function DiagnosticStateIcon({ state }: { state: ConnectionDiagnosticStep["state"] }) {
  const className = state === "checking" ? "h-3.5 w-3.5 motion-safe:animate-spin" : "h-3.5 w-3.5";

  if (state === "attention") {
    return <AlertTriangle className={className} strokeWidth={2} />;
  }

  if (state === "checking") {
    return <LoaderCircle className={className} strokeWidth={2} />;
  }

  if (state === "complete") {
    return <CircleCheck className={className} strokeWidth={2} />;
  }

  if (state === "unavailable") {
    return <CircleMinus className={className} strokeWidth={2} />;
  }

  return <Circle className={className} strokeWidth={2} />;
}
