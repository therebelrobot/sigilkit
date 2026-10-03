/**
 * Rename the engine once you've picked a name.
 *
 *   npm run rename -- <new-name>
 *
 * Rewrites the name "sigil" everywhere it appears in source,
 * config, docs and the demo: the package name and imports, the "sigil-source"
 * export condition, the worker name and identity header. CSS class names stay
 * `vc-*` so your stylesheets don't churn. Then reinstall to relink workspaces.
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const OLD = "sigil";
const next = process.argv[2]?.trim();

if (!next || !/^[a-z][a-z0-9-]{1,213}$/.test(next) || next === OLD) {
  console.error("usage: npm run rename -- <new-name>   (lowercase letters, digits, dashes)");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", ".wrangler"]);
const EXT = /\.(ts|tsx|js|json|jsonc|css|html|ink|md|ya?ml)$/;
const changed: string[] = [];

function walk(dir: string): void {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name === "package-lock.json") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (EXT.test(name)) rewrite(path);
  }
}

function rewrite(path: string): void {
  if (path === import.meta.filename) return;
  const before = readFileSync(path, "utf8");
  // Capitalized prose ("Verbcoin") and the plain name.
  const after = before.replaceAll(OLD, next!).replaceAll(cap(OLD), cap(next!));
  if (after !== before) {
    writeFileSync(path, after);
    changed.push(relative(root, path));
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

walk(root);
rmSync(join(root, "package-lock.json"), { force: true });
console.log(`Renamed ${OLD} -> ${next} in ${changed.length} files:\n  ${changed.join("\n  ")}`);
console.log("\nNext: rm -rf node_modules && npm install");
