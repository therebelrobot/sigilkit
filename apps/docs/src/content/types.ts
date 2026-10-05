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

export interface MarkdownPage {
  title: string;
  html: string;
  headings: MarkdownHeading[];
  sections: MarkdownSection[];
}

export interface CodeFile {
  source: string;
  html: string;
}

export type SearchablePage = Pick<MarkdownPage, "title" | "sections">;
