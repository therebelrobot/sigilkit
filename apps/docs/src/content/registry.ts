import { ALL_DOCS, DOC_SECTIONS, type DocEntry } from "../site";
import type { MarkdownPage, SearchablePage } from "./types";
import architectureIndex from "../../../../docs/ARCHITECTURE.md?sections";
import audioDesignIndex from "../../../../docs/AUDIO_DESIGN.md?sections";
import levelDesignIndex from "../../../../docs/LEVEL_DESIGN.md?sections";
import visualDesignIndex from "../../../../docs/VISUAL_DESIGN.md?sections";
import enginePackage from "../../../../packages/sigilkit/package.json";

/*
 * Every docs page, rendered at build time. Pages load when visited; search uses
 * a text-only index of all of them. The repository's own guides in docs/ are
 * imported directly, so they have one source of truth.
 */

const authoredPages = import.meta.glob<MarkdownPage>("./docs/*.md", { import: "default" });
const guidePages: Record<string, () => Promise<MarkdownPage>> = {
  "docs/ARCHITECTURE.md": () => import("../../../../docs/ARCHITECTURE.md").then((module) => module.default),
  "docs/AUDIO_DESIGN.md": () => import("../../../../docs/AUDIO_DESIGN.md").then((module) => module.default),
  "docs/LEVEL_DESIGN.md": () => import("../../../../docs/LEVEL_DESIGN.md").then((module) => module.default),
  "docs/VISUAL_DESIGN.md": () => import("../../../../docs/VISUAL_DESIGN.md").then((module) => module.default),
};

const authoredIndex = import.meta.glob<SearchablePage>("./docs/*.md", { query: "?sections", import: "default", eager: true });
const guideIndex: Record<string, SearchablePage> = {
  "docs/ARCHITECTURE.md": architectureIndex,
  "docs/AUDIO_DESIGN.md": audioDesignIndex,
  "docs/LEVEL_DESIGN.md": levelDesignIndex,
  "docs/VISUAL_DESIGN.md": visualDesignIndex,
};

const loadedPages = new Map<string, MarkdownPage>();

/** A page already loaded this visit, so revisits render at once. */
export function cachedDocPage(slug: string): MarkdownPage | undefined {
  return loadedPages.get(slug);
}

export async function loadDocPage(slug: string): Promise<MarkdownPage | undefined> {
  const entry = ALL_DOCS.find((doc) => doc.slug === slug);
  if (!entry) return undefined;
  const load = entry.repoFile ? guidePages[entry.repoFile] : authoredPages[`./docs/${slug}.md`];
  const page = await load?.();
  if (page) loadedPages.set(slug, page);
  return page;
}

export function searchablePage(slug: string): SearchablePage | undefined {
  const entry = ALL_DOCS.find((doc) => doc.slug === slug);
  if (!entry) return undefined;
  return entry.repoFile ? guideIndex[entry.repoFile] : authoredIndex[`./docs/${slug}.md`];
}

export function sectionOf(entry: DocEntry): string {
  return DOC_SECTIONS.find((section) => section.pages.includes(entry))?.title ?? "";
}

export const ENGINE_VERSION: string = enginePackage.version;
