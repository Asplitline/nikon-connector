import { defaultLocale, type Locale, t } from "../../i18n";
import type {
  ConnectionDiagnostics,
  DiagnosticActionKind,
} from "./connectionDiagnostics";
import { DiagnosticStepRow } from "./ConnectionDiagnosticDialog";
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

// 照片舞台的空态：普通连接问题显示当前阻塞点；存储卡不可读时直接展开完整检查步骤
export function ConnectionSetup({
  diagnostics,
  locale = defaultLocale,
  onDiagnosticAction,
  onOpenConnectionCheck,
  onPrimaryAction,
}: {
  diagnostics: ConnectionDiagnostics;
  locale?: Locale;
  onDiagnosticAction?: (kind: DiagnosticActionKind) => void;
  onOpenConnectionCheck: () => void;
  onPrimaryAction: () => void;
}) {
  const blockingStep = diagnostics.steps.find(
    (step) => step.id === diagnostics.blockingStepId,
  );
  const shouldShowFullChecklist = diagnostics.blockingStepId === "card_photos";
  const connectionSteps = diagnostics.steps.filter(
    (step) => step.id !== "rating_write_back",
  );

  return (
    <section className="w-[min(520px,100%)] rounded-[10px] border border-line bg-surface p-6 text-ink shadow-[0_18px_54px_color-mix(in_oklch,var(--app-ink)_10%,transparent)] max-sm:p-5">
      <p className={connectionKickerClass(diagnostics.severity)}>
        {diagnostics.summary}
      </p>
      <h2 className="mt-3 text-ui-title font-ui-760 tracking-normal leading-tight">
        {blockingStep?.label ?? t("connection.cameraConnected", undefined, locale)}
      </h2>
      <p className="mt-2 max-w-[58ch] text-ui-4xl leading-[1.55] wrap-anywhere text-muted">
        {blockingStep?.detail ?? t("connection.cameraReadyForReview", undefined, locale)}
      </p>
      {shouldShowFullChecklist ? (
        <ol className="mt-4 grid gap-1.5 m-0 p-0">
          {connectionSteps.map((step) => (
            <DiagnosticStepRow
              compact
              key={step.id}
              locale={locale}
              onAction={onDiagnosticAction}
              step={step}
            />
          ))}
        </ol>
      ) : null}
      <div className="mt-[22px] flex flex-wrap gap-2.5">
        <button
          className={buttonClass("primary")}
          disabled={diagnostics.primaryAction.kind === "none"}
          onClick={onPrimaryAction}
          type="button"
        >
          {diagnostics.primaryAction.label}
        </button>
        {shouldShowFullChecklist ? null : (
          <button className={buttonClass("secondary")} onClick={onOpenConnectionCheck} type="button">
            {t("connection.checkOpen", undefined, locale)}
          </button>
        )}
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
