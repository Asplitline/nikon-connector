import { beforeEach, describe, expect, it, vi } from "vitest";
import { openSettingsLink } from "./settingsLinks";

const openPath = vi.fn();
const openUrl = vi.fn();

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: (target: string) => openPath(target),
  openUrl: (target: string) => openUrl(target),
}));

describe("settings links", () => {
  beforeEach(() => {
    openPath.mockClear();
    openUrl.mockClear();
  });

  it("opens web update feeds as URLs", async () => {
    await openSettingsLink("https://example.test/latest.json");

    expect(openUrl).toHaveBeenCalledWith("https://example.test/latest.json");
    expect(openPath).not.toHaveBeenCalled();
  });

  it("opens local log values as paths", async () => {
    await openSettingsLink("/tmp/nikon-connector.log");

    expect(openPath).toHaveBeenCalledWith("/tmp/nikon-connector.log");
    expect(openUrl).not.toHaveBeenCalled();
  });
});
