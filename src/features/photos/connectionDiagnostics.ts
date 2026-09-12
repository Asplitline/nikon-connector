import type { CameraConnectionState, CameraDevice } from "./types";
import { type Locale, t } from "../../i18n";

export type DiagnosticStepState =
  | "complete"
  | "checking"
  | "attention"
  | "pending"
  | "unavailable";

export type DiagnosticActionKind =
  | "none"
  | "rescan"
  | "open_camera_privacy"
  | "open_macos_privacy"
  | "open_image_capture";

export interface DiagnosticAction {
  label: string;
  kind: DiagnosticActionKind;
}

export interface ConnectionDiagnosticStep {
  id:
    | "usb_power"
    | "macos_access"
    | "camera_identity"
    | "card_photos"
    | "rating_write_back";
  label: string;
  state: DiagnosticStepState;
  detail: string;
  action?: DiagnosticAction;
}

export interface ConnectionDiagnostics {
  summary: string;
  severity: "ready" | "checking" | "attention" | "demo";
  blockingStepId: ConnectionDiagnosticStep["id"] | null;
  primaryAction: DiagnosticAction;
  steps: ConnectionDiagnosticStep[];
}

export function createConnectionDiagnostics({
  camera,
  connectionState,
  photoCount,
  scanError,
  locale,
}: {
  camera: CameraDevice | null;
  connectionState: CameraConnectionState;
  photoCount: number;
  scanError: string | null;
  locale?: Locale;
}): ConnectionDiagnostics {
  const translate = (
    key: Parameters<typeof t>[0],
    values?: Parameters<typeof t>[1],
  ) => t(key, values, locale);
  const realCamera = camera && camera.connection !== "mock" ? camera : null;
  const isMock = camera?.connection === "mock";
  const accessError = isMacOSAccessError(scanError);

  if (connectionState === "loading") {
    return {
      summary: translate("diagnostic.loading"),
      severity: "checking",
      blockingStepId: "usb_power",
      primaryAction: {
        label: translate("diagnostic.action.scanning"),
        kind: "none",
      },
      steps: [
        step("usb_power", translate("diagnostic.usbPower"), "checking", translate("diagnostic.detail.lookForUsb")),
        pendingMacOSAccessStep(translate),
        step("camera_identity", translate("diagnostic.cameraIdentity"), "pending", translate("diagnostic.detail.noIdentity")),
        step("card_photos", translate("diagnostic.cardPhotos"), "pending", translate("diagnostic.detail.cardCheckedAfterOpen")),
        writeBackStep(translate),
      ],
    };
  }

  if (accessError) {
    return {
      summary: translate("diagnostic.macosAttention"),
      severity: "attention",
      blockingStepId: "macos_access",
      primaryAction: {
        label: translate("diagnostic.action.openCameraPrivacy"),
        kind: "open_camera_privacy",
      },
      steps: [
        step("usb_power", translate("diagnostic.usbPower"), "pending", translate("diagnostic.detail.confirmPower")),
        step(
          "macos_access",
          translate("diagnostic.macosAccess"),
          "attention",
          translate("diagnostic.detail.accessBlocked"),
          {
            label: translate("diagnostic.action.openCameraPrivacy"),
            kind: "open_camera_privacy",
          },
        ),
        step("camera_identity", translate("diagnostic.cameraIdentity"), "pending", translate("diagnostic.detail.accessBlockedUntilAllowed")),
        step("card_photos", translate("diagnostic.cardPhotos"), "pending", translate("diagnostic.detail.cardBlocked")),
        writeBackStep(translate),
      ],
    };
  }

  if (isMock) {
    return {
      summary: translate("diagnostic.demo"),
      severity: "demo",
      blockingStepId: "usb_power",
      primaryAction: {
        label: translate("diagnostic.action.scanForRealCamera"),
        kind: "rescan",
      },
      steps: [
        step("usb_power", translate("diagnostic.usbPower"), "attention", translate("diagnostic.detail.demoCamera")),
        pendingMacOSAccessStep(translate),
        step("camera_identity", translate("diagnostic.cameraIdentity"), "pending", translate("diagnostic.detail.noIdentity")),
        step("card_photos", translate("diagnostic.cardPhotos"), "pending", translate("diagnostic.detail.demoPhotos")),
        writeBackStep(translate),
      ],
    };
  }

  if (!realCamera) {
    return {
      summary: translate("diagnostic.waiting"),
      severity: "attention",
      blockingStepId: "usb_power",
      primaryAction: {
        label: translate("diagnostic.action.scanAgain"),
        kind: "rescan",
      },
      steps: [
        step("usb_power", translate("diagnostic.usbPower"), "attention", translate("diagnostic.detail.usbConnect")),
        pendingMacOSAccessStep(translate),
        step("camera_identity", translate("diagnostic.cameraIdentity"), "pending", translate("diagnostic.detail.noVisibleCamera")),
        step("card_photos", translate("diagnostic.cardPhotos"), "pending", translate("diagnostic.detail.insertCard")),
        writeBackStep(translate),
      ],
    };
  }

  if (photoCount === 0) {
    return {
      summary: translate("diagnostic.cameraFoundNoCard"),
      severity: "attention",
      blockingStepId: "card_photos",
      primaryAction: {
        label: translate("diagnostic.action.scanAgain"),
        kind: "rescan",
      },
      steps: [
        step("usb_power", translate("diagnostic.usbPower"), "complete", translate("diagnostic.detail.cameraVisible")),
        step("macos_access", translate("diagnostic.macosAccess"), "complete", translate("diagnostic.detail.appCanAccess")),
        step("camera_identity", translate("diagnostic.cameraIdentity"), "complete", cameraLabel(realCamera)),
        step(
          "card_photos",
          translate("diagnostic.cardPhotos"),
          "attention",
          translate("diagnostic.detail.cardNotReadable"),
          {
            label: translate("connection.imageCapture"),
            kind: "open_image_capture",
          },
        ),
        writeBackStep(translate),
      ],
    };
  }

  return {
    summary: translate("diagnostic.cameraReady"),
    severity: "ready",
    blockingStepId: null,
    primaryAction: {
      label: translate("diagnostic.action.reviewPhotos"),
      kind: "none",
    },
    steps: [
      step("usb_power", translate("diagnostic.usbPower"), "complete", translate("diagnostic.detail.cameraVisible")),
      step("macos_access", translate("diagnostic.macosAccess"), "complete", translate("diagnostic.detail.appCanAccess")),
      step("camera_identity", translate("diagnostic.cameraIdentity"), "complete", cameraLabel(realCamera)),
      step("card_photos", translate("diagnostic.cardPhotos"), "complete", photoReadyDetail(photoCount, locale)),
      writeBackStep(translate),
    ],
  };
}

function step(
  id: ConnectionDiagnosticStep["id"],
  label: string,
  state: DiagnosticStepState,
  detail: string,
  action?: DiagnosticAction,
): ConnectionDiagnosticStep {
  return { id, label, state, detail, action };
}

function writeBackStep(translate: typeof t) {
  return step(
    "rating_write_back",
    translate("diagnostic.ratingWriteBack"),
    "complete",
    translate("diagnostic.detail.writeBackUnavailable"),
  );
}

function pendingMacOSAccessStep(translate: typeof t) {
  return step(
    "macos_access",
    translate("diagnostic.macosAccess"),
    "pending",
    translate("diagnostic.detail.pendingAccess"),
    {
      label: translate("diagnostic.action.openCameraPrivacy"),
      kind: "open_camera_privacy",
    },
  );
}

function photoReadyDetail(photoCount: number, locale?: Locale) {
  if (locale === "en-US") {
    return `${photoCount} photo${photoCount === 1 ? "" : "s"} ready to review.`;
  }

  return t("diagnostic.detail.photoReady", { count: photoCount }, locale);
}

function cameraLabel(camera: CameraDevice) {
  return `${camera.name}${camera.model ? ` (${camera.model})` : ""}`;
}

function isMacOSAccessError(scanError: string | null) {
  return /access|permission|denied|not permitted|privacy|authorization/i.test(
    scanError ?? "",
  );
}
