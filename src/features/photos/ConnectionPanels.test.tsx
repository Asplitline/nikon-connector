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

  it("shows the full checklist directly when card photos cannot be read", () => {
    const cardDiagnostics: ConnectionDiagnostics = {
      blockingStepId: "card_photos",
      primaryAction: { kind: "rescan", label: "重新扫描" },
      severity: "attention",
      steps: [
        {
          detail: "相机已通过 USB 可见。",
          id: "usb_power",
          label: "USB 和电源",
          state: "complete",
        },
        {
          detail: "应用可以访问相机。",
          id: "macos_access",
          label: "macOS 访问权限",
          state: "complete",
        },
        {
          detail: "Nikon Z6III",
          id: "camera_identity",
          label: "Nikon 设备",
          state: "complete",
        },
        {
          detail: "未读取到照片。然后检查存储卡、USB 模式以及正在使用相机的应用。",
          id: "card_photos",
          label: "存储卡照片",
          state: "attention",
        },
        {
          detail: "Nikon SDK 写回尚未接入。评级暂时只保存在本地。",
          id: "rating_write_back",
          label: "评级写回",
          state: "unavailable",
        },
      ],
      summary: "已找到相机，但无法读取存储卡",
    };

    const setupMarkup = renderToStaticMarkup(
      <ConnectionSetup
        diagnostics={cardDiagnostics}
        onOpenConnectionCheck={() => undefined}
        onPrimaryAction={() => undefined}
      />,
    );

    expect(setupMarkup).toContain("<ol");
    expect(setupMarkup).toContain("w-[min(520px,100%)]");
    expect(setupMarkup).toContain("text-ui-title");
    expect(setupMarkup).toContain("text-ui-2xl");
    expect(setupMarkup).not.toContain("w-[min(620px,100%)]");
    expect(setupMarkup).not.toContain("text-[clamp(1.75rem,4vw,3.15rem)]");
    expect(setupMarkup).toContain("USB 和电源");
    expect(setupMarkup).toContain("macOS 访问权限");
    expect(setupMarkup).toContain("Nikon 设备");
    expect(setupMarkup).toContain("存储卡照片");
    expect(setupMarkup).not.toContain("评级写回");
    expect(setupMarkup).not.toContain("检查连接");
  });
});
