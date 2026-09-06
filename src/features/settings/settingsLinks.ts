import { openPath, openUrl } from "@tauri-apps/plugin-opener";

export function isOpenableSettingsValue(value: string | null | undefined): value is string {
  if (!value) return false;
  return isWebUrl(value) || isLocalPath(value);
}

export async function openSettingsLink(target: string): Promise<void> {
  if (isWebUrl(target)) {
    await openUrl(target);
    return;
  }

  await openPath(target);
}

function isWebUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isLocalPath(value: string) {
  return value.startsWith("/") || value.startsWith("~/");
}
