import { useEffect } from "react";
import { writeAppLog } from "../../lib/appApi";

// 把未捕获错误和未处理的 promise rejection 送进桌面端日志
export function useGlobalErrorLog() {
  useEffect(() => {
    writeAppLog("info", "frontend.app", "application mounted");

    function reportError(event: ErrorEvent) {
      writeAppLog("error", "frontend.window", event.message);
    }

    function reportRejection(event: PromiseRejectionEvent) {
      const reason =
        event.reason instanceof Error ? event.reason.message : String(event.reason);
      writeAppLog("error", "frontend.promise", reason);
    }

    window.addEventListener("error", reportError);
    window.addEventListener("unhandledrejection", reportRejection);

    return () => {
      window.removeEventListener("error", reportError);
      window.removeEventListener("unhandledrejection", reportRejection);
    };
  }, []);
}
