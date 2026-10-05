import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import GithubSlugger from "github-slugger";
import { Marked, type Token, type Tokens } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import type { Plugin } from "vite";
import { escapeHtml, highlightInk, highlightWalkmap } from "../src/highlight/ink";
import { ALL_DOCS, REPOSITORY_URL } from "../src/site";

/*
 * Two build-time transforms, so the browser never ships a Markdown parser or Shiki:
 *
 * - `import page from "./page.md"` -> { title, html, headings, sections }
 * - `import index from "./page.md?sections"` -> { title, sections }, for search
 * - `import file from "./game.ts?code"` -> { source, html }, the file's own text and
 *   its highlighted HTML. Lessons show their real source this way, so the code a
 *   reader sees is exactly the code that runs.
 */

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const DOCS_CONTENT = resolve(import.meta.dirname, "../src/content/docs");

const SHIKI_LANGUAGES = ["ts", "tsx", "js", "jsx", "json", "jsonc", "sh", "bash", "ini", "html", "css", "diff"] as const;
const LANGUAGE_ALIASES: Record<string, string> = { typescript: "ts", javascript: "js", shell: "sh", zsh: "sh", console: "sh" };

let highlighterPromise: Promise<Highlighter> | null = null;
const highlighter = () =>
  (highlighterPromise ??= createHighlighter({ themes: ["vitesse-light", "vitesse-dark"], langs: [...SHIKI_LANGUAGES] }));

export async function highlightCode(source: string, language: string): Promise<string> {
  const lang = LANGUAGE_ALIASES[language] ?? language;
  if (lang === "ink") return `<pre class="code ink"><code>${highlightInk(source)}</code></pre>`;
  if (lang === "walkmap") return `<pre class="code walkmap"><code>${highlightWalkmap(source)}</code></pre>`;
  if (!(SHIKI_LANGUAGES as readonly string[]).includes(lang)) return `<pre class="code"><code>${escapeHtml(source)}</code></pre>`;
  const html = (await highlighter()).codeToHtml(source, {
    lang,
    themes: { light: "vitesse-light", dark: "vitesse-dark" },
    defaultColor: false,
  });
  return html.replace('<pre class="shiki', '<pre class="code shiki');
}

const codeBlock = (inner: string, language: string) =>
  `<div class="code-block" data-lang="${escapeHtml(language || "text")}">` +
  `<button type="button" class="code-copy" aria-label="Copy code">Copy</button>${inner}</div>`;

export interface MarkdownHeading {
  depth: number;
  id: string;
  text: string;
}

export interface MarkdownSection {
  id: string;
  heading: string;
  text: string;
}

/** Where a link in a Markdown file should go on the site. */
function rewriteHref(href: string, file: string, base: string): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return href;
  if (href.startsWith("/")) return base + href.slice(1);
  const [pathPart, hash] = href.split("#") as [string, string | undefined];
  const target = resolve(dirname(file), pathPart);
  const suffix = hash ? `#${hash}` : "";
  if (target.startsWith(DOCS_CONTENT) && target.endsWith(".md")) return `${base}docs/${basename(target, ".md")}${suffix}`;
  const fromRoot = relative(REPO_ROOT, target);
  const guide = ALL_DOCS.find((doc) => doc.repoFile === fromRoot);
  if (guide) return `${base}docs/${guide.slug}${suffix}`;
  return `${REPOSITORY_URL}/blob/main/${fromRoot}${suffix}`;
}

/** Text of inline tokens with Markdown stripped, for headings and search. */
function plain(tokens: Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => ("tokens" in token && token.tokens ? plain(token.tokens) : "text" in token ? String(token.text) : ""))
    .join("");
}

export async function renderMarkdown(source: string, file: string, base: string) {
  const slugger = new GithubSlugger();
  const marked = new Marked({ gfm: true });
  const tokens = marked.lexer(source);

  let title = "";
  const headings: MarkdownHeading[] = [];
  const sections: MarkdownSection[] = [{ id: "", heading: "", text: "" }];
  const highlighted = new Map<Tokens.Code, string>();

  const collect = async (list: Token[]) => {
    for (const token of list) {
      if (token.type === "code") {
        const code = token as Tokens.Code;
        const language = (code.lang ?? "").split(/\s/)[0]!;
        highlighted.set(code, codeBlock(await highlightCode(code.text.replace(/\n$/, ""), language), language));
        sections.at(-1)!.text += ` ${code.text}`;
      } else if (token.type === "heading") {
        const heading = token as Tokens.Heading;
        const text = plain(heading.tokens);
        if (heading.depth === 1 && !title) {
          title = text;
          continue;
        }
        const id = slugger.slug(text);
        (heading as Tokens.Heading & { id: string }).id = id;
        if (heading.depth <= 3) headings.push({ depth: heading.depth, id, text });
        sections.push({ id, heading: text, text: "" });
      } else if (token.type === "paragraph" || token.type === "text") {
        sections.at(-1)!.text += ` ${plain((token as Tokens.Paragraph).tokens)}`;
      } else if (token.type === "list") {
        for (const item of (token as Tokens.List).items) await collect(item.tokens);
      } else if (token.type === "blockquote") {
        await collect((token as Tokens.Blockquote).tokens);
      } else if (token.type === "table") {
        const table = token as Tokens.Table;
        sections.at(-1)!.text += ` ${[table.header, ...table.rows].flat().map((cell) => plain(cell.tokens)).join(" ")}`;
      }
    }
  };
  await collect(tokens);
  // Drop the page title from the body; the page header renders it.
  const titleIndex = tokens.findIndex((token) => token.type === "heading" && (token as Tokens.Heading).depth === 1);
  if (titleIndex >= 0) tokens.splice(titleIndex, 1);

  marked.use({
    renderer: {
      code(token) {
        return highlighted.get(token) ?? codeBlock(`<pre class="code"><code>${escapeHtml(token.text)}</code></pre>`, "");
      },
      heading(token) {
        const id = (token as Tokens.Heading & { id?: string }).id;
        const inner = this.parser.parseInline(token.tokens);
        if (!id) return `<h${token.depth}>${inner}</h${token.depth}>\n`;
        return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${token.depth}>\n`;
      },
      link(token) {
        const href = rewriteHref(token.href, file, base);
        const external = /^https?:/.test(href) ? ' target="_blank" rel="noreferrer"' : "";
        const titleAttribute = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        return `<a href="${escapeHtml(href)}"${titleAttribute}${external}>${this.parser.parseInline(token.tokens)}</a>`;
      },
      table(token) {
        const head = token.header.map((cell) => `<th${cell.align ? ` align="${cell.align}"` : ""}>${this.parser.parseInline(cell.tokens)}</th>`).join("");
        const rows = token.rows
          .map((row) => `<tr>${row.map((cell) => `<td${cell.align ? ` align="${cell.align}"` : ""}>${this.parser.parseInline(cell.tokens)}</td>`).join("")}</tr>`)
          .join("");
        return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
      blockquote(token) {
        const inner = this.parser.parse(token.tokens);
        const callout = /^<p>\[!(NOTE|TIP|WARNING)\]\s*/.exec(inner);
        if (!callout) return `<blockquote>${inner}</blockquote>\n`;
        const kind = callout[1]!.toLowerCase();
        return `<aside class="callout callout-${kind}"><p class="callout-title">${callout[1]![0]}${kind.slice(1)}</p><p>${inner.slice(callout[0].length)}</aside>\n`;
      },
    },
  });

  const html = marked.parser(tokens);
  return {
    title,
    html,
    headings,
    sections: sections.filter((section) => section.text.trim() || section.heading).map((section) => ({ ...section, text: section.text.replace(/\s+/g, " ").trim() })),
  };
}

const CODE_QUERY = "?code";
const SECTIONS_QUERY = "?sections";
/** Virtual id prefix, so no other plugin (CSS, TypeScript) treats the source file as its own. */
const CODE_PREFIX = "\0sigilkit-code:";
// Hides the real extension too: Vite's CSS plugin matches any id ending in ".css".
const CODE_SUFFIX = ".code.js";

export function markdown(): Plugin {
  let base = "/";
  return {
    name: "sigilkit-docs:markdown",
    enforce: "pre",
    configResolved(config) {
      base = config.base;
    },
    async resolveId(source, importer) {
      if (!source.endsWith(CODE_QUERY)) return null;
      const resolved = await this.resolve(source.slice(0, -CODE_QUERY.length), importer, { skipSelf: true });
      return resolved ? `${CODE_PREFIX}${resolved.id}${CODE_SUFFIX}` : null;
    },
    async load(id) {
      if (id.startsWith(CODE_PREFIX)) {
        const path = id.slice(CODE_PREFIX.length, -CODE_SUFFIX.length);
        this.addWatchFile(path);
        const source = readFileSync(path, "utf8");
        const extension = path.split(".").pop()!;
        const language = extension === "txt" ? "walkmap" : extension;
        return `export default ${JSON.stringify({ source, html: await highlightCode(source.replace(/\n$/, ""), language) })};`;
      }
      // "page.md?sections" is the search index's view of a page: no HTML.
      const sectionsOnly = id.endsWith(SECTIONS_QUERY);
      const markdownPath = sectionsOnly ? id.slice(0, -SECTIONS_QUERY.length) : id;
      if (markdownPath.endsWith(".md")) {
        this.addWatchFile(markdownPath);
        const page = await renderMarkdown(readFileSync(markdownPath, "utf8"), markdownPath, base);
        const exported = sectionsOnly ? { title: page.title, sections: page.sections } : page;
        return `export default ${JSON.stringify(exported)};`;
      }
      return null;
    },
  };
}
