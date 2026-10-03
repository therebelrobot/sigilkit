/**
 * Bump the published package, commit, tag and push.
 *
 *   npm run release:patch | release:minor | release:major
 *
 * `npm version -w <pkg>` bumps a workspace but never commits or tags, so this
 * does those steps itself. The pushed v* tag triggers .github/workflows/release.yml.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PKG = "sigilkit";
const level = process.argv[2];
if (!level || !["patch", "minor", "major"].includes(level)) {
  console.error("usage: tsx scripts/release.ts <patch|minor|major>");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" }).trim();

if (run("git", ["status", "--porcelain"])) {
  console.error("Working tree has uncommitted changes; commit or stash them first.");
  process.exit(1);
}

// Bumps packages/<PKG>/package.json and updates package-lock.json; no git side effects.
run("npm", ["version", level, "-w", PKG, "--no-git-tag-version"]);
const { version } = JSON.parse(readFileSync(join(root, "packages", PKG, "package.json"), "utf8")) as { version: string };
const tag = `v${version}`;

run("git", ["add", `packages/${PKG}/package.json`, "package-lock.json"]);
run("git", ["commit", "-m", `chore: release ${tag}`]);
run("git", ["tag", "-a", tag, "-m", `${PKG} ${tag}`]);
run("git", ["push"]);
run("git", ["push", "origin", tag]);
console.log(`Released ${PKG} ${tag}; the release workflow publishes it to npm.`);
