import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConnectionDiagnosticDialog } from "./ConnectionDiagnosticDialog";
import { ConnectionSetup } from "./ConnectionPanels";
import type { ConnectionDiagnostics } from "./connectionDiagnostics";

const diagnostics: ConnectionDiagnostics = {
  blockingStepId: "usb_power",
  primaryAction: { kind: "rescan", label: "Scan again" },
  severity: "attention",
  steps: [
    {
      detail: "Connect the Z6III with a USB-C data cable.",
      id: "usb_power",
      label: "USB and power",
      state: "attention",
    },
    {
      action: { kind: "open_macos_privacy", label: "打开相机隐私设置" },
      detail:
        "如果相机访问被阻止，请允许 Nikon Connector 访问：系统设置 > 隐私与安全性 > 相机 > Nikon Connector。",
      id: "macos_access",
      label: "macOS access",
      state: "pending",
    },
  ],
  summary: "Waiting for USB camera",
};

describe("connection setup UI", () => {
  it("keeps detailed checks in the modal instead of the main frame", () => {
    const setupMarkup = renderToStaticMarkup(
      <ConnectionSetup
        diagnostics={diagnostics}
        onOpenConnectionCheck={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );
    const dialogMarkup = renderToStaticMarkup(
      <ConnectionDiagnosticDialog
        diagnostics={diagnostics}
        onAction={() => undefined}
        onClose={() => undefined}
        onOpenImageCapture={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    expect(setupMarkup).not.toContain("<ol");
    expect(setupMarkup).toContain("检查连接");
    expect(dialogMarkup).toContain("<ol");
    expect(dialogMarkup).toContain("macOS access");
    expect(dialogMarkup).toContain("系统设置 &gt; 隐私与安全性 &gt; 相机 &gt; Nikon Connector");
    expect(dialogMarkup).toContain("打开相机隐私设置");
  });
});
