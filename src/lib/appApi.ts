import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

export interface AppInfo {
  name: string;
  version: string;
  changelog: string;
  updateEndpoint: string;
}

export interface AvailableUpdate {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
}

let pendingUpdate: Update | null = null;

const canUseTauri = () => "__TAURI_INTERNALS__" in window;

export async function getAppInfo(): Promise<AppInfo> {
  if (!canUseTauri()) {
    return {
      name: "Nikon Connector",
      version: import.meta.env.PACKAGE_VERSION ?? "0.1.3",
      changelog: browserChangelog,
      updateEndpoint:
        "https://github.com/Asplitline/nikon-connector/releases/latest/download/latest.json",
    };
  }

  return invoke<AppInfo>("get_app_info");
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!canUseTauri()) {
    throw new Error("Updates can only be checked in the desktop app.");
  }

  pendingUpdate = await check();

  if (!pendingUpdate) {
    return null;
  }

  return {
    body: pendingUpdate.body,
    currentVersion: pendingUpdate.currentVersion,
    date: pendingUpdate.date,
    version: pendingUpdate.version,
  };
}

export async function installPendingUpdate(
  onEvent?: (event: DownloadEvent) => void,
) {
  if (!pendingUpdate) {
    throw new Error("Check for an update before installing.");
  }

  await pendingUpdate.downloadAndInstall(onEvent);
  await relaunch();
}

const browserChangelog = `# Changelog

## [Unreleased]

- Desktop updates are available in the packaged Tauri app.
`;
