import { describe, expect, it } from "vitest";
import { defaultLocale, t } from "./i18n";

describe("i18n", () => {
  it("uses Chinese as the default locale", () => {
    expect(defaultLocale).toBe("zh-CN");
    expect(t("app.cameraCard")).toBe("相机卡");
  });

  it("supports English translations", () => {
    expect(t("app.cameraCard", undefined, "en-US")).toBe("Camera Card");
  });

  it("interpolates translation values", () => {
    expect(t("status.mountedPhotos", { camera: "Nikon Z6III", count: 3 })).toBe(
      "Nikon Z6III 已挂载，包含 3 张照片。",
    );
  });
});
