#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
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

export function tauriBuildArgs(argv = []) {
  if (argv.includes("--bundles") || argv.includes("-b") || argv.includes("--no-bundle")) {
    return ["run", "tauri", "build", ...argv];
  }

  return ["run", "tauri", "build", "--bundles", "app", ...argv];
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
      if (!maybeVersion) {
        throw new Error("Usage: bun run release:prepare -- <version>");
      }
      const version = parseVersion(maybeVersion).value;
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
    default:
      throw new Error(
        "Usage: node scripts/release.mjs <check|prepare|tag|build> [version] [--tag vX.Y.Z]",
      );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cli(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
