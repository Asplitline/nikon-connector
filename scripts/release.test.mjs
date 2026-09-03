import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test, afterEach } from "vitest";

import {
  buildGithubReleaseArgs,
  buildReleaseCommitArgs,
  changelogNotesForVersion,
  defaultReleaseInstallerPath,
  defaultUpdaterManifestPath,
  nextVersion,
  parseVersion,
  prepareChangelog,
  readProjectVersions,
  setProjectVersion,
  tagForVersion,
  tauriBuildArgs,
  validateReleaseState,
} from "./release.mjs";

const roots = [];

async function makeFixture(version = "0.1.0") {
  const root = await mkdtemp(join(tmpdir(), "nikon-release-"));
  roots.push(root);
  await mkdir(join(root, "src-tauri"), { recursive: true });

  await writeFile(
    join(root, "package.json"),
    `${JSON.stringify({ name: "nikon-connector", private: true, version }, null, 2)}\n`,
  );
  await writeFile(
    join(root, "src-tauri", "tauri.conf.json"),
    `${JSON.stringify({ productName: "Nikon Connector", version }, null, 2)}\n`,
  );
  await writeFile(
    join(root, "src-tauri", "Cargo.toml"),
    `[package]\nname = "nikon-connector"\nversion = "${version}"\nedition = "2021"\n`,
  );
  await writeFile(
    join(root, "src-tauri", "Cargo.lock"),
    `version = 4\n\n[[package]]\nname = "nikon-connector"\nversion = "${version}"\n\n[[package]]\nname = "tauri"\nversion = "2.0.0"\n`,
  );
  await writeFile(
    join(root, "CHANGELOG.md"),
    `# Changelog\n\nAll notable changes to Nikon Connector are documented in this file.\n\n## [Unreleased]\n\n### Added\n\n- Tag-driven release workflow.\n\n## [${version}] - 2026-08-31\n\n### Added\n\n- Initial app shell.\n\n`,
  );

  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("release version parsing", () => {
  test("accepts SemVer versions and rejects prerelease or prefixed input", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, value: "1.2.3" });
    expect(() => parseVersion("v1.2.3")).toThrow(/SemVer/);
    expect(() => parseVersion("1.2.3-beta.1")).toThrow(/SemVer/);
  });

  test("formats the annotated release tag from a version", () => {
    expect(tagForVersion("1.2.3")).toBe("v1.2.3");
  });

  test("increments patch by default and supports major/minor aliases", () => {
    expect(nextVersion("1.2.3")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "z")).toBe("1.2.4");
    expect(nextVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "y")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "major")).toBe("2.0.0");
    expect(nextVersion("1.2.3", "x")).toBe("2.0.0");
  });

  test("accepts explicit SemVer versions when resolving the next release", () => {
    expect(nextVersion("1.2.3", "2.1.0")).toBe("2.1.0");
    expect(() => nextVersion("1.2.3", "beta")).toThrow(/version bump/);
  });
});

describe("Tauri build arguments", () => {
  test("defaults to DMG installer bundling and allows explicit bundle overrides", () => {
    expect(tauriBuildArgs([])).toEqual(["run", "tauri", "build", "--bundles", "dmg"]);
    expect(tauriBuildArgs(["--bundles", "app"])).toEqual([
      "run",
      "tauri",
      "build",
      "--bundles",
      "app",
    ]);
  });
});

describe("project version files", () => {
  test("reads matching versions from app and Tauri metadata", async () => {
    const root = await makeFixture("0.2.3");

    await expect(readProjectVersions(root)).resolves.toEqual({
      "package.json": "0.2.3",
      "src-tauri/tauri.conf.json": "0.2.3",
      "src-tauri/Cargo.toml": "0.2.3",
      "src-tauri/Cargo.lock": "0.2.3",
    });
  });

  test("updates every release version source together", async () => {
    const root = await makeFixture("0.1.0");

    await setProjectVersion(root, "0.2.0");

    await expect(readProjectVersions(root)).resolves.toEqual({
      "package.json": "0.2.0",
      "src-tauri/tauri.conf.json": "0.2.0",
      "src-tauri/Cargo.toml": "0.2.0",
      "src-tauri/Cargo.lock": "0.2.0",
    });
  });

  test("reports mismatched release metadata before packaging", async () => {
    const root = await makeFixture("0.1.0");
    await writeFile(
      join(root, "src-tauri", "tauri.conf.json"),
      `${JSON.stringify({ productName: "Nikon Connector", version: "0.1.1" }, null, 2)}\n`,
    );

    await expect(validateReleaseState(root)).rejects.toThrow(/Version mismatch/);
  });
});

describe("changelog promotion", () => {
  test("promotes unreleased notes into a dated version section", async () => {
    const root = await makeFixture("0.1.0");

    await prepareChangelog(root, "0.2.0", "2026-09-01");

    await expect(readFile(join(root, "CHANGELOG.md"), "utf8")).resolves.toBe(
      `# Changelog\n\nAll notable changes to Nikon Connector are documented in this file.\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-01\n\n### Added\n\n- Tag-driven release workflow.\n\n## [0.1.0] - 2026-08-31\n\n### Added\n\n- Initial app shell.\n\n`,
    );
  });

  test("rejects duplicate version sections", async () => {
    const root = await makeFixture("0.1.0");
    await prepareChangelog(root, "0.2.0", "2026-09-01");

    await expect(prepareChangelog(root, "0.2.0", "2026-09-01")).rejects.toThrow(
      /already exists/,
    );
  });
});

describe("GitHub release publishing", () => {
  test("extracts changelog notes for the release version", async () => {
    const root = await makeFixture("0.1.0");

    await expect(changelogNotesForVersion(root, "0.1.0")).resolves.toBe(
      "### Added\n\n- Initial app shell.",
    );
  });

  test("builds gh release create arguments from a tag and artifact", () => {
    expect(
      buildGithubReleaseArgs({
        tag: "v0.1.1",
        title: "Nikon Connector v0.1.1",
        notes: "### Added\n\n- Release tooling.",
        assets: ["dist/releases/Nikon-Connector-v0.1.1-macos-aarch64.dmg"],
      }),
    ).toEqual([
      "release",
      "create",
      "v0.1.1",
      "dist/releases/Nikon-Connector-v0.1.1-macos-aarch64.dmg",
      "--title",
      "Nikon Connector v0.1.1",
      "--notes",
      "### Added\n\n- Release tooling.",
      "--verify-tag",
    ]);
  });

  test("uses the conventional macOS installer path for GitHub assets", () => {
    expect(defaultReleaseInstallerPath("/repo", "0.1.1")).toBe(
      "/repo/dist/releases/Nikon-Connector-v0.1.1-macos-aarch64.dmg",
    );
  });

  test("uses the conventional updater manifest path for GitHub assets", () => {
    expect(defaultUpdaterManifestPath("/repo")).toBe("/repo/dist/releases/latest.json");
  });
});

describe("one-command release", () => {
  test("builds a conventional release commit message", () => {
    expect(buildReleaseCommitArgs("0.2.0")).toEqual([
      "commit",
      "-m",
      "release: v0.2.0",
    ]);
  });
});
