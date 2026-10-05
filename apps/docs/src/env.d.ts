/// <reference types="vite/client" />

/** Rendered at build time by plugins/markdown.ts. */
declare module "*.md" {
  const page: import("./content/types").MarkdownPage;
  export default page;
}

/** A source file and its highlighted HTML, from plugins/markdown.ts. */
declare module "*?code" {
  const file: import("./content/types").CodeFile;
  export default file;
}

/** A Markdown page's title and plain-text sections, for search. */
declare module "*.md?sections" {
  const index: import("./content/types").SearchablePage;
  export default index;
}
