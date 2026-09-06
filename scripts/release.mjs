#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const TAG_RE = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const versionFiles = {
  packageJson: "package.json",
  tauriConfig: "src-tauri/tauri.conf.json",
  cargoToml: "src-tauri/Cargo.toml",
  cargoLock: "src-tauri/Cargo.lock",
};

const releaseEnvKeys = new Set([
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PATH",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
]);

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === `"` || quote === `'`) && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function expandHomePath(value) {
  if (value === "~") {
    return process.env.HOME ?? value;
  }
  if (value.startsWith("~/")) {
    return join(process.env.HOME ?? "~", value.slice(2));
  }
  if (value.startsWith("$HOME/")) {
    return join(process.env.HOME ?? "$HOME", value.slice(6));
  }
  return value;
}

export function parseReleaseEnv(contents) {
  const env = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!releaseEnvKeys.has(key)) {
      continue;
    }

    let value = unquoteEnvValue(trimmed.slice(separatorIndex + 1));
    if (key === "TAURI_SIGNING_PRIVATE_KEY" || key === "TAURI_SIGNING_PRIVATE_KEY_PATH") {
      value = expandHomePath(value);
    }
    env[key] = value;
  }

  return env;
}

export async function loadReleaseEnv(root = process.cwd()) {
  let envFile;
  try {
    envFile = await readFile(join(root, ".env.release.local"), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  const env = parseReleaseEnv(envFile);
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY && process.env.TAURI_SIGNING_PRIVATE_KEY_PATH) {
    process.env.TAURI_SIGNING_PRIVATE_KEY = (
      await readFile(process.env.TAURI_SIGNING_PRIVATE_KEY_PATH, "utf8")
    ).trim();
  } else if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
    try {
      process.env.TAURI_SIGNING_PRIVATE_KEY = (
        await readFile(process.env.TAURI_SIGNING_PRIVATE_KEY, "utf8")
      ).trim();
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return env;
}

export function parseVersion(input) {
  const value = String(input ?? "").trim();
  const match = VERSION_RE.exec(value);
  if (!match) {
    throw new Error(`Expected SemVer version MAJOR.MINOR.PATCH, got "${input}".`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    value,
  };
}

export function parseTag(input) {
  const value = String(input ?? "").trim();
  const match = TAG_RE.exec(value);
  if (!match) {
    throw new Error(`Expected release tag vMAJOR.MINOR.PATCH, got "${input}".`);
  }

  return {
    tag: value,
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

export function tagForVersion(version) {
  return `v${parseVersion(version).value}`;
}

export function nextVersion(currentVersion, bump = "patch") {
  const current = parseVersion(currentVersion);
  const value = String(bump ?? "patch").trim().toLowerCase();

  if (VERSION_RE.test(value)) {
    return parseVersion(value).value;
  }

  switch (value || "patch") {
    case "x":
    case "major":
      return `${current.major + 1}.0.0`;
    case "y":
    case "minor":
      return `${current.major}.${current.minor + 1}.0`;
    case "z":
    case "patch":
      return `${current.major}.${current.minor}.${current.patch + 1}`;
    default:
      throw new Error(
        `Expected version bump x, y, z, major, minor, patch, or MAJOR.MINOR.PATCH, got "${bump}".`,
      );
  }
}

export function tauriBuildArgs(argv = []) {
  if (argv.includes("--bundles") || argv.includes("-b") || argv.includes("--no-bundle")) {
    return ["run", "tauri", "build", ...argv];
  }

  return ["run", "tauri", "build", "--bundles", "app,dmg", ...argv];
}

export function defaultReleaseInstallerPath(root, version) {
  return join(
    root,
    "dist",
    "releases",
    `Nikon-Connector-v${parseVersion(version).value}-macos-aarch64.dmg`,
  );
}

export function defaultReleaseArchivePath(root, version) {
  return join(
    root,
    "dist",
    "releases",
    `Nikon-Connector-v${parseVersion(version).value}-macos-aarch64.app.tar.gz`,
  );
}

export function defaultUpdaterManifestPath(root) {
  return join(root, "dist", "releases", "latest.json");
}

export function tauriDmgPath(root, version) {
  return join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "dmg",
    `Nikon Connector_${parseVersion(version).value}_aarch64.dmg`,
  );
}

export function tauriUpdaterManifestPath(root) {
  return join(root, "src-tauri", "target", "release", "bundle", "macos", "latest.json");
}

export function tauriUpdaterArchivePath(root) {
  return join(
    root,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos",
    "Nikon Connector.app.tar.gz",
  );
}

export function tauriUpdaterSignaturePath(root) {
  return `${tauriUpdaterArchivePath(root)}.sig`;
}

export function updaterArchiveUrl(version) {
  return `https://github.com/Asplitline/nikon-connector/releases/latest/download/Nikon-Connector-v${parseVersion(version).value}-macos-aarch64.app.tar.gz`;
}

export function buildUpdaterManifest({ notes, pubDate, signature, url, version }) {
  return {
    version: parseVersion(version).value,
    notes,
    pub_date: pubDate,
    platforms: {
      "darwin-aarch64": {
        signature,
        url,
      },
    },
  };
}

export function buildGithubReleaseArgs({ tag, title, notes, assets = [] }) {
  parseTag(tag);
  return [
    "release",
    "create",
    tag,
    ...assets,
    "--title",
    title,
    "--notes",
    notes,
    "--verify-tag",
  ];
}

export function buildReleaseCommitArgs(version) {
  return ["commit", "-m", `release: ${tagForVersion(version)}`];
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, data) {
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

function readCargoPackageVersion(contents) {
  const match = /^\[package\][\s\S]*?^version = "([^"]+)"/m.exec(contents);
  if (!match) {
    throw new Error("Could not find [package] version in src-tauri/Cargo.toml.");
  }
  return match[1];
}

function setCargoPackageVersion(contents, version) {
  if (!/^\[package\][\s\S]*?^version = "[^"]+"/m.test(contents)) {
    throw new Error("Could not find [package] version in src-tauri/Cargo.toml.");
  }
  return contents.replace(
    /^(\[package\][\s\S]*?^version = )"[^"]+"/m,
    `$1"${version}"`,
  );
}

function readCargoLockPackageVersion(contents) {
  const blocks = contents.split(/\n(?=\[\[package\]\]\n)/);
  const block = blocks.find((entry) => /^name = "nikon-connector"$/m.test(entry));
  const match = block?.match(/^version = "([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find nikon-connector package version in src-tauri/Cargo.lock.');
  }
  return match[1];
}

function setCargoLockPackageVersion(contents, version) {
  const blocks = contents.split(/\n(?=\[\[package\]\]\n)/);
  const index = blocks.findIndex((entry) => /^name = "nikon-connector"$/m.test(entry));
  if (index === -1) {
    throw new Error('Could not find nikon-connector package in src-tauri/Cargo.lock.');
  }

  blocks[index] = blocks[index].replace(/^version = "[^"]+"/m, `version = "${version}"`);
  return blocks.join("\n");
}

export async function readProjectVersions(root = process.cwd()) {
  const packageJson = await readJson(join(root, versionFiles.packageJson));
  const tauriConfig = await readJson(join(root, versionFiles.tauriConfig));
  const cargoToml = await readFile(join(root, versionFiles.cargoToml), "utf8");
  const cargoLock = await readFile(join(root, versionFiles.cargoLock), "utf8");

  return {
    "package.json": packageJson.version,
    "src-tauri/tauri.conf.json": tauriConfig.version,
    "src-tauri/Cargo.toml": readCargoPackageVersion(cargoToml),
    "src-tauri/Cargo.lock": readCargoLockPackageVersion(cargoLock),
  };
}

async function readCurrentProjectVersion(root) {
  const versions = await readProjectVersions(root);
  const entries = Object.entries(versions);
  const uniqueVersions = new Set(entries.map(([, version]) => version));

  if (uniqueVersions.size !== 1) {
    const details = entries.map(([file, version]) => `${file}: ${version}`).join(", ");
    throw new Error(`Version mismatch across release metadata: ${details}`);
  }

  return entries[0][1];
}

async function resolveReleaseVersion(root, versionOrBump) {
  return nextVersion(await readCurrentProjectVersion(root), versionOrBump);
}

export async function setProjectVersion(root, inputVersion) {
  const version = parseVersion(inputVersion).value;
  const packagePath = join(root, versionFiles.packageJson);
  const tauriPath = join(root, versionFiles.tauriConfig);
  const cargoTomlPath = join(root, versionFiles.cargoToml);
  const cargoLockPath = join(root, versionFiles.cargoLock);

  const packageJson = await readJson(packagePath);
  const tauriConfig = await readJson(tauriPath);
  const cargoToml = await readFile(cargoTomlPath, "utf8");
  const cargoLock = await readFile(cargoLockPath, "utf8");

  packageJson.version = version;
  tauriConfig.version = version;

  await writeJson(packagePath, packageJson);
  await writeJson(tauriPath, tauriConfig);
  await writeFile(cargoTomlPath, setCargoPackageVersion(cargoToml, version));
  await writeFile(cargoLockPath, setCargoLockPackageVersion(cargoLock, version));
}

export async function prepareChangelog(root, inputVersion, date = today()) {
  const version = parseVersion(inputVersion).value;
  const changelogPath = join(root, "CHANGELOG.md");
  const changelog = await readFile(changelogPath, "utf8");

  if (new RegExp(`^## \\[${escapeRegExp(version)}\\] - `, "m").test(changelog)) {
    throw new Error(`CHANGELOG.md section for ${version} already exists.`);
  }

  const unreleasedHeading = "## [Unreleased]";
  const unreleasedIndex = changelog.indexOf(unreleasedHeading);
  if (unreleasedIndex === -1) {
    throw new Error("CHANGELOG.md must contain a ## [Unreleased] section.");
  }

  const notesStart = unreleasedIndex + unreleasedHeading.length;
  const nextSection = changelog.indexOf("\n## [", notesStart);
  const before = changelog.slice(0, notesStart);
  const notes = changelog.slice(notesStart, nextSection === -1 ? changelog.length : nextSection);
  const after = nextSection === -1 ? "" : changelog.slice(nextSection);

  if (notes.trim().length === 0) {
    throw new Error("CHANGELOG.md Unreleased section has no release notes to promote.");
  }

  const next = `${before}\n\n## [${version}] - ${date}${notes.replace(/^\n*/, "\n\n")}${after}`;
  await writeFile(changelogPath, next.endsWith("\n") ? next : `${next}\n`);
}

export async function changelogNotesForVersion(root, inputVersion) {
  const version = parseVersion(inputVersion).value;
  const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
  const heading = new RegExp(`^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m");
  const match = heading.exec(changelog);

  if (!match) {
    throw new Error(`CHANGELOG.md must contain a dated section for ${version}.`);
  }

  const notesStart = match.index + match[0].length;
  const nextSection = changelog.indexOf("\n## [", notesStart);
  const notes = changelog.slice(notesStart, nextSection === -1 ? changelog.length : nextSection).trim();

  if (notes.length === 0) {
    throw new Error(`CHANGELOG.md section for ${version} has no release notes.`);
  }

  return notes;
}

export async function validateReleaseState(root = process.cwd(), options = {}) {
  const versions = await readProjectVersions(root);
  const entries = Object.entries(versions);
  const uniqueVersions = new Set(entries.map(([, version]) => version));

  if (uniqueVersions.size !== 1) {
    const details = entries.map(([file, version]) => `${file}: ${version}`).join(", ");
    throw new Error(`Version mismatch across release metadata: ${details}`);
  }

  const version = entries[0][1];
  parseVersion(version);

  const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
  if (!/^## \[Unreleased\]/m.test(changelog)) {
    throw new Error("CHANGELOG.md must contain a ## [Unreleased] section.");
  }
  if (!new RegExp(`^## \\[${escapeRegExp(version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, "m").test(changelog)) {
    throw new Error(`CHANGELOG.md must contain a dated section for ${version}.`);
  }

  if (options.tag) {
    const parsed = parseTag(options.tag);
    if (parsed.version !== version) {
      throw new Error(`Git tag ${parsed.tag} does not match release version ${version}.`);
    }
  }

  return { version, tag: tagForVersion(version), versions };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: "inherit",
      shell: false,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
      }
    });
  });
}

async function runCapture(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(
          new Error(`${command} ${args.join(" ")} exited with code ${code}.\n${stderr.trim()}`),
        );
      }
    });
  });
}

async function tagExists(tag) {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], {
        cwd: process.cwd(),
        stdio: "ignore",
      });
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("missing tag"))));
    });
    return true;
  } catch {
    return false;
  }
}

async function createAnnotatedTag(root = process.cwd()) {
  const { version, tag } = await validateReleaseState(root);
  if (await tagExists(tag)) {
    throw new Error(`Git tag ${tag} already exists.`);
  }
  await run("git", ["tag", "-a", tag, "-m", `Release ${tag}`], { cwd: root });
  return { version, tag };
}

async function pushReleaseTag(root = process.cwd()) {
  const { tag } = await validateReleaseState(root);
  if (!(await tagExists(tag))) {
    throw new Error(`Git tag ${tag} does not exist. Run bun run release:tag first.`);
  }

  const branch = await runCapture("git", ["branch", "--show-current"], { cwd: root });
  if (!branch) {
    throw new Error("Cannot push release from a detached HEAD.");
  }

  await run("git", ["push", "origin", branch], { cwd: root });
  await run("git", ["push", "origin", tag], { cwd: root });
  return { branch, tag };
}

async function commitRelease(root, version) {
  await run("git", ["add", "."], { cwd: root });
  await run("git", buildReleaseCommitArgs(version), { cwd: root });
}

async function packageRelease(root = process.cwd(), argv = []) {
  const { version } = await validateReleaseState(root);
  await loadReleaseEnv(root);
  await run("bun", ["run", "check"], { cwd: root });
  await run("bun", ["run", "test"], { cwd: root });
  await run("bun", tauriBuildArgs(argv), { cwd: root });

  const installerPath = defaultReleaseInstallerPath(root, version);
  const archivePath = defaultReleaseArchivePath(root, version);
  const updaterManifestPath = defaultUpdaterManifestPath(root);
  const notes = await changelogNotesForVersion(root, version);
  const signature = (await readFile(tauriUpdaterSignaturePath(root), "utf8")).trim();
  await mkdir(join(root, "dist", "releases"), { recursive: true });
  await copyFile(tauriDmgPath(root, version), installerPath);
  await copyFile(tauriUpdaterArchivePath(root), archivePath);
  await writeJson(
    updaterManifestPath,
    buildUpdaterManifest({
      notes,
      pubDate: new Date().toISOString(),
      signature,
      url: updaterArchiveUrl(version),
      version,
    }),
  );
  return [installerPath, archivePath, updaterManifestPath];
}

async function publishGithubRelease(root = process.cwd(), assets = []) {
  const { version, tag } = await validateReleaseState(root);
  const notes = await changelogNotesForVersion(root, version);
  const releaseAssets =
    assets.length > 0
      ? assets
      : [defaultReleaseInstallerPath(root, version), defaultUpdaterManifestPath(root)];

  await run(
    "gh",
    buildGithubReleaseArgs({
      tag,
      title: `Nikon Connector ${tag}`,
      notes,
      assets: releaseAssets,
    }),
    { cwd: root },
  );

  return { tag, assets: releaseAssets };
}

async function cli(argv) {
  const [command, maybeVersion] = argv;
  const root = process.cwd();

  switch (command) {
    case "check": {
      const tagIndex = argv.indexOf("--tag");
      const tag = tagIndex === -1 ? undefined : argv[tagIndex + 1];
      const state = await validateReleaseState(root, { tag });
      console.log(`Release metadata is consistent for ${state.tag}.`);
      break;
    }
    case "prepare": {
      const version = await resolveReleaseVersion(root, maybeVersion);
      await setProjectVersion(root, version);
      await prepareChangelog(root, version);
      const state = await validateReleaseState(root);
      console.log(`Prepared ${state.tag}. Review, commit, then run bun run release:tag.`);
      break;
    }
    case "tag": {
      const { tag } = await createAnnotatedTag(root);
      console.log(`Created annotated tag ${tag}.`);
      break;
    }
    case "build": {
      await validateReleaseState(root);
      await run("bun", ["run", "check"], { cwd: root });
      await run("bun", ["run", "test"], { cwd: root });
      await run("bun", tauriBuildArgs(argv.slice(1)), { cwd: root });
      break;
    }
    case "package": {
      const assets = await packageRelease(root, argv.slice(1));
      console.log(`Packaged release assets: ${assets.join(", ")}`);
      break;
    }
    case "push": {
      const { branch, tag } = await pushReleaseTag(root);
      console.log(`Pushed ${branch} and ${tag} to origin.`);
      break;
    }
    case "github": {
      const { tag, assets } = await publishGithubRelease(root, argv.slice(1));
      console.log(`Published GitHub Release ${tag} with ${assets.length} asset(s).`);
      break;
    }
    case "publish": {
      const assets = await packageRelease(root);
      await pushReleaseTag(root);
      const { tag } = await publishGithubRelease(root, assets);
      console.log(`Published ${tag} to GitHub.`);
      break;
    }
    case "all": {
      const version = await resolveReleaseVersion(root, maybeVersion);
      await setProjectVersion(root, version);
      await prepareChangelog(root, version);
      await validateReleaseState(root);
      const assets = await packageRelease(root);
      await commitRelease(root, version);
      const { tag } = await createAnnotatedTag(root);
      await pushReleaseTag(root);
      await publishGithubRelease(root, assets);
      console.log(`Prepared, committed, tagged, packaged, pushed, and published ${tag}.`);
      break;
    }
    default:
      throw new Error(
        "Usage: node scripts/release.mjs <check|prepare|tag|build|package|push|github|publish|all> [version] [--tag vX.Y.Z]",
      );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
