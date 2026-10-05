import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { ALL_DOCS, ALL_LESSONS } from "../src/site";

/*
 * GitHub Pages serves files, not an app server. After the build, copy index.html
 * to <route>/index.html for every route in site.ts, so deep links load with a 200
 * and a page-specific <title>. 404.html is the same app, which shows its own
 * not-found page for anything else.
 */

const SITE_NAME = "sigilkit";

function titleFor(route: string): string {
  const [, section, slug] = route.split("/");
  if (section === "docs" && slug) return `${ALL_DOCS.find((doc) => doc.slug === slug)?.title} · ${SITE_NAME} docs`;
  if (section === "learn" && slug) return `${ALL_LESSONS.find((lesson) => lesson.slug === slug)?.title} · Learn ${SITE_NAME}`;
  if (section === "docs") return `Documentation · ${SITE_NAME}`;
  if (section === "learn") return `Learn · ${SITE_NAME}`;
  return `${SITE_NAME} · a composable adventure engine for React`;
}

export function staticPages(routes: string[]): Plugin {
  let outDir = "dist";
  return {
    name: "sigilkit-docs:static-pages",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const template = readFileSync(join(outDir, "index.html"), "utf8");
      const withTitle = (title: string) => template.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
      for (const route of routes) {
        if (route === "/") continue;
        const directory = join(outDir, route);
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, "index.html"), withTitle(titleFor(route)));
      }
      writeFileSync(join(outDir, "404.html"), withTitle(`Not found · ${SITE_NAME}`));
      // No Jekyll processing: keeps files starting with "_" and skips a slow step.
      writeFileSync(join(outDir, ".nojekyll"), "");
    },
  };
}
