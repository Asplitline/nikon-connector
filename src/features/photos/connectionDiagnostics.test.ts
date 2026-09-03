import { describe, expect, it } from "vitest";
import { createConnectionDiagnostics } from "./connectionDiagnostics";
import type { CameraDevice } from "./types";

const imageCaptureCamera: CameraDevice = {
  id: "z6iii-real",
  name: "Nikon Z6III",
  model: "Z6III",
  connection: "image_capture",
};

const mockCamera: CameraDevice = {
  id: "z6iii",
  name: "Nikon Z6III",
  model: "Z6III",
  connection: "mock",
};

describe("connection diagnostics", () => {
  it("uses Chinese diagnostics by default", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: imageCaptureCamera,
      connectionState: "connected",
      photoCount: 2,
      scanError: null,
    });

    expect(diagnostics.summary).toBe("相机已就绪");
    expect(diagnostics.primaryAction.label).toBe("查看照片");
    expect(diagnostics.steps[3].detail).toContain("2 张照片");
  });

  it("marks a real camera and readable photos as complete while write-back is unavailable", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: imageCaptureCamera,
      connectionState: "connected",
      photoCount: 1,
      scanError: null,
      locale: "en-US",
    });

    expect(diagnostics.summary).toBe("Camera ready");
    expect(diagnostics.blockingStepId).toBeNull();
    expect(diagnostics.primaryAction).toEqual({
      label: "Review photos",
      kind: "none",
    });
    expect(diagnostics.steps.map((step) => [step.id, step.state])).toEqual([
      ["usb_power", "complete"],
      ["macos_access", "complete"],
      ["camera_identity", "complete"],
      ["card_photos", "complete"],
      ["rating_write_back", "unavailable"],
    ]);
    expect(diagnostics.steps[3].detail).toContain("1 photo");
  });

  it("shows a clear action when no camera is detected", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: null,
      connectionState: "not_connected",
      photoCount: 0,
      scanError: null,
      locale: "en-US",
    });

    expect(diagnostics.summary).toBe("Waiting for USB camera");
    expect(diagnostics.blockingStepId).toBe("usb_power");
    expect(diagnostics.primaryAction.label).toBe("Scan again");
    expect(diagnostics.steps[0].state).toBe("attention");
    expect(diagnostics.steps[0].detail).toContain("USB-C");
    expect(diagnostics.steps[1].state).toBe("pending");
    expect(diagnostics.steps[1].detail).toContain("Camera > Nikon Connector");
    expect(diagnostics.steps[1].action?.kind).toBe("open_camera_privacy");
  });

  it("separates macOS access failures from cable and power checks", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: null,
      connectionState: "error",
      photoCount: 0,
      scanError: "Operation not permitted: camera access denied.",
      locale: "en-US",
    });

    expect(diagnostics.summary).toBe("macOS access needs attention");
    expect(diagnostics.blockingStepId).toBe("macos_access");
    expect(diagnostics.primaryAction).toEqual({
      label: "Open Camera Privacy",
      kind: "open_camera_privacy",
    });
    expect(diagnostics.steps[0].state).toBe("pending");
    expect(diagnostics.steps[1].state).toBe("attention");
    expect(diagnostics.steps[1].detail).toContain("Privacy & Security");
    expect(diagnostics.steps[1].detail).toContain("Camera");
    expect(diagnostics.steps[1].action).toEqual({
      label: "Open Camera Privacy",
      kind: "open_camera_privacy",
    });
  });

  it("flags a connected camera with no readable card photos", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: imageCaptureCamera,
      connectionState: "connected",
      photoCount: 0,
      scanError: null,
      locale: "en-US",
    });

    expect(diagnostics.summary).toBe("Camera found, card not readable");
    expect(diagnostics.blockingStepId).toBe("card_photos");
    expect(diagnostics.primaryAction.label).toBe("Scan again");
    expect(diagnostics.steps[2].state).toBe("complete");
    expect(diagnostics.steps[3].state).toBe("attention");
    expect(diagnostics.steps[3].detail).toContain("memory card");
  });

  it("labels mock data as demo mode instead of a real USB connection", () => {
    const diagnostics = createConnectionDiagnostics({
      camera: mockCamera,
      connectionState: "connected",
      photoCount: 3,
      scanError: null,
      locale: "en-US",
    });

    expect(diagnostics.summary).toBe("Demo data is showing");
    expect(diagnostics.blockingStepId).toBe("usb_power");
    expect(diagnostics.primaryAction.label).toBe("Scan for real camera");
    expect(diagnostics.steps[0].state).toBe("attention");
    expect(diagnostics.steps[0].detail).toContain("demo camera");
    expect(diagnostics.steps[1].detail).toContain("Camera > Nikon Connector");
    expect(diagnostics.steps[1].action?.kind).toBe("open_camera_privacy");
  });
});
