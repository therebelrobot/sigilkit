import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Compiler, CompilerOptions } from "inkjs/full";
import type { Plugin } from "vite";

/** Compile Ink source to the JSON InkRunner loads. Throws with all compiler errors. */
export function compileInk(source: string, file?: string): string {
  const errors: string[] = [];
  const options = new CompilerOptions(
    file ?? null,
    [],
    false,
    (message, type) => {
      // type 2 = error in inkjs's ErrorType enum; warnings and author TODOs pass through.
      if (type === 2) errors.push(message);
    },
    file ? includeHandler(dirname(file)) : null,
  );
  const compiler = new Compiler(source, options);
  const story = compiler.Compile();
  const all = [...new Set([...errors, ...compiler.errors])];
  if (all.length || !story) throw new Error(`Ink compile failed${file ? ` (${file})` : ""}:\n${all.join("\n")}`);
  return story.ToJson() ?? "";
}

/** Resolves INCLUDE lines relative to the root .ink file. */
function includeHandler(root: string) {
  return {
    ResolveInkFilename: (name: string) => resolve(root, name),
    LoadInkFileContents: (path: string) => readFileSync(path, "utf8"),
  };
}

/**
 * `import story from "./main.ink"` gives you compiled Ink JSON.
 * INCLUDEd files are resolved relative to the importing .ink file and recompile on change.
 */
export function ink(): Plugin {
  return {
    name: "sigilkit:ink",
    transform(code, id) {
      if (!id.endsWith(".ink")) return null;
      for (const m of code.matchAll(/^\s*INCLUDE\s+(.+?)\s*$/gm)) this.addWatchFile(resolve(dirname(id), m[1]!));
      return { code: `export default ${JSON.stringify(compileInk(code, id))};`, map: null };
    },
  };
}
