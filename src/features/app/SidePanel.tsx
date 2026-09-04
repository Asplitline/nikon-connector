import { PerformancePanel } from "../performance/PerformancePanel";
import type { PerformanceMetrics } from "../performance/metrics";
import { ConnectionDiagnosticPanel } from "../photos/ConnectionPanels";
import type { ConnectionDiagnostics } from "../photos/connectionDiagnostics";
import { ExportPanel } from "../photos/ExportPanel";
import { formatConnection } from "../photos/labels";
import { ReviewControls } from "../photos/ReviewControls";
import type { ShootingReview } from "../photos/shootingReview";
import { ShootingReviewPanel } from "../photos/ShootingReviewPanel";
import type { CameraConnectionState, CameraDevice } from "../photos/types";
import type { CatalogControls, ExportControls, LibraryStats } from "./uiTypes";
import type { Locale, t as translate } from "../../i18n";

// 左侧栏：设备状态、连接检查、筛选排序、导出、复盘、性能与图库统计
export function SidePanel({
  activeCamera,
  catalogControls,
  connectionLabel,
  connectionState,
  diagnostics,
  exportControls,
  isReviewReady,
  library,
  locale,
  onOpenConnectionCheck,
  onOpenSettings,
  performanceMetrics,
  shootingReview,
  status,
  tr,
}: {
  activeCamera: CameraDevice | null;
  catalogControls: CatalogControls;
  connectionLabel: string;
  connectionState: CameraConnectionState;
  diagnostics: ConnectionDiagnostics;
  exportControls: ExportControls;
  isReviewReady: boolean;
  library: LibraryStats;
  locale: Locale;
  onOpenConnectionCheck: () => void;
  onOpenSettings: () => void;
  performanceMetrics: PerformanceMetrics;
  shootingReview: ShootingReview;
  status: string;
  tr: (
    key: Parameters<typeof translate>[0],
    values?: Parameters<typeof translate>[1],
  ) => string;
}) {
  return (
    <aside className="side-panel min-h-0 overflow-y-auto border-r border-line bg-panel px-5 py-5 max-nav:grid max-nav:grid-cols-[minmax(0,1.15fr)_minmax(180px,0.85fr)_minmax(160px,0.7fr)] max-nav:items-start max-nav:gap-4 max-nav:border-r-0 max-nav:border-b max-nav:p-4 max-sm:grid-cols-1">
      <div className="brand-row flex items-start justify-between gap-3 max-sm:flex-col">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            {tr("app.name")}
          </p>
          <h1 className="mt-2 text-ui-title font-semibold leading-tight tracking-normal text-ink">
            {tr("app.cameraCard")}
          </h1>
        </div>
        <span className="inline-flex min-h-7 min-w-0 items-center gap-2 rounded-full border border-line bg-[color-mix(in_oklch,var(--app-surface)_82%,transparent)] px-2.5 text-ui-md font-ui-650 whitespace-nowrap text-muted mt-0.5 max-sm:self-start">
          <span
            aria-hidden="true"
            className={[
              "h-2 w-2 rounded-full",
              connectionState === "connected"
                ? "bg-ready"
                : connectionState === "error"
                  ? "bg-danger"
                  : "bg-muted",
            ].join(" ")}
          />
          <span>{connectionLabel}</span>
        </span>
      </div>

      <section className="mt-8 space-y-3 max-nav:mt-0">
        <p className="section-label">{tr("connection.device")}</p>
        {activeCamera && activeCamera.connection !== "mock" ? (
          <div className="min-w-0 rounded-lg border border-line bg-surface p-3.5 shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)]">
            <p
              className="min-w-0 wrap-anywhere text-base font-semibold leading-snug"
              title={activeCamera.name}
            >
              {activeCamera.name}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {formatConnection(activeCamera.connection, locale)}
            </p>
          </div>
        ) : (
          <div className="min-w-0 wrap-anywhere rounded-lg border border-dashed border-line p-4 text-sm leading-6 text-muted shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)]">
            {status}
          </div>
        )}
      </section>

      <ConnectionDiagnosticPanel
        diagnostics={diagnostics}
        locale={locale}
        onOpen={onOpenConnectionCheck}
      />

      <ReviewControls
        disabled={!isReviewReady}
        filter={catalogControls.filter}
        locale={locale}
        onFilterChange={catalogControls.onFilterChange}
        onSortChange={catalogControls.onSortChange}
        sort={catalogControls.sort}
        visibleCount={isReviewReady ? library.visibleCount : 0}
      />

      <ExportPanel
        disabled={!isReviewReady || exportControls.selection.count === 0}
        destination={exportControls.destination}
        exportCount={exportControls.selection.count}
        exportSizeMb={exportControls.selection.sizeMb}
        locale={locale}
        mode={exportControls.mode}
        onDestinationChange={exportControls.onDestinationChange}
        onExport={exportControls.onExport}
        onModeChange={exportControls.onModeChange}
        status={exportControls.status}
      />

      <ShootingReviewPanel
        disabled={!isReviewReady}
        locale={locale}
        review={shootingReview}
      />

      <PerformancePanel locale={locale} metrics={performanceMetrics} />

      <section className="mt-8 space-y-3 max-nav:mt-0">
        <p className="section-label">{tr("connection.library")}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm [&>div]:min-w-0 [&>div]:shadow-[0_1px_0_color-mix(in_oklch,var(--app-ink)_4%,transparent)]">
          <div className="rounded-md bg-surface px-3 py-3">
            <dt className="text-muted">{tr("connection.photos")}</dt>
            <dd className="mt-1.5 text-2xl font-semibold leading-none">
              {isReviewReady ? library.photoCount : 0}
            </dd>
          </div>
          <div className="rounded-md bg-surface px-3 py-3">
            <dt className="text-muted">{tr("connection.rated")}</dt>
            <dd className="mt-1.5 text-2xl font-semibold leading-none">
              {library.ratedCount}
            </dd>
          </div>
        </dl>
      </section>

      <button
        className="settings-entry mt-8 w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-left text-sm font-semibold text-ink transition hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        onClick={onOpenSettings}
        type="button"
      >
        ⚙ {tr("settings.settings")}
      </button>
    </aside>
  );
}
