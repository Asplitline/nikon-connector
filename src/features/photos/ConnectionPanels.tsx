import { defaultLocale, type Locale, t } from "../../i18n";
import type { ConnectionDiagnostics } from "./connectionDiagnostics";
import { connectionKickerClass, diagnosticSummaryClass } from "../app/statusStyles";
import { buttonClass } from "../app/buttonStyles";

// 侧栏入口：只展示概要，详细检查步骤留在弹窗里
export function ConnectionDiagnosticPanel({
  diagnostics,
  locale = defaultLocale,
  onOpen,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onOpen: () => void;
}) {
  return (
    <section className="min-w-0 mt-8 space-y-3 [&>div:first-child]:flex-wrap">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">{t("connection.check", undefined, locale)}</p>
        <span className={diagnosticSummaryClass(diagnostics.severity)}>
          {diagnostics.summary}
        </span>
      </div>
      <p className="text-ui-4xl leading-[1.6] wrap-anywhere text-muted">
        {t("connection.checkCopy", undefined, locale)}
      </p>
      <button className={buttonClass("secondary", { compact: true })} onClick={onOpen} type="button">
        {t("connection.checkOpen", undefined, locale)}
      </button>
    </section>
  );
}

// 照片舞台的空态：只提示当前阻塞的那一步
export function ConnectionSetup({
  diagnostics,
  locale = defaultLocale,
  onOpenConnectionCheck,
  onPrimaryAction,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onOpenConnectionCheck: () => void;
  onPrimaryAction: () => void;
}) {
  const blockingStep = diagnostics.steps.find(
    (step) => step.id === diagnostics.blockingStepId,
  );

  return (
    <section className="w-[min(620px,100%)] rounded-[10px] border border-line bg-surface p-[clamp(20px,4vw,34px)] text-ink shadow-[0_18px_54px_color-mix(in_oklch,var(--app-ink)_10%,transparent)]">
      <p className={connectionKickerClass(diagnostics.severity)}>
        {diagnostics.summary}
      </p>
      <h2 className="mt-[18px] text-[clamp(1.75rem,4vw,3.15rem)] font-ui-760 tracking-normal leading-[0.98]">
        {blockingStep?.label ?? t("connection.cameraConnected", undefined, locale)}
      </h2>
      <p className="mt-4 max-w-[52ch] text-base leading-[1.65] wrap-anywhere text-muted">
        {blockingStep?.detail ?? t("connection.cameraReadyForReview", undefined, locale)}
      </p>
      <div className="mt-[22px] flex flex-wrap gap-2.5">
        <button
          className={buttonClass("primary")}
          disabled={diagnostics.primaryAction.kind === "none"}
          onClick={onPrimaryAction}
          type="button"
        >
          {diagnostics.primaryAction.label}
        </button>
        <button className={buttonClass("secondary")} onClick={onOpenConnectionCheck} type="button">
          {t("connection.checkOpen", undefined, locale)}
        </button>
      </div>
    </section>
  );
}

export function EmptyPhotoDetails({ locale }: { locale: Locale }) {
  return (
    <section className="mt-[18px] border-t border-t-[color-mix(in_oklch,var(--app-line)_70%,transparent)] pt-[18px]">
      <p className="section-label">{t("detail.emptyTitle", undefined, locale)}</p>
      <p className="mt-3 text-sm font-semibold leading-6">
        {t("connection.connectCamera", undefined, locale)}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {t("detail.emptyBody", undefined, locale)}
      </p>
    </section>
  );
}
