import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { MenuIcon } from "../components/Icons";
import { cachedDocPage, loadDocPage, sectionOf } from "../content/registry";
import type { MarkdownHeading, MarkdownPage } from "../content/types";
import { interceptLinkClicks, Link } from "../router";
import { ALL_DOCS, DOC_SECTIONS, REPOSITORY_URL } from "../site";
import { NotFound } from "./NotFound";

/** Copy buttons on rendered code blocks, and internal links without reloads. */
export function handleContentClick(event: MouseEvent): void {
  const copyButton = (event.target as HTMLElement).closest<HTMLButtonElement>(".code-copy");
  if (copyButton) {
    const code = copyButton.parentElement?.querySelector("pre")?.textContent ?? "";
    void navigator.clipboard?.writeText(code).then(() => {
      copyButton.dataset.copied = "";
      copyButton.textContent = "Copied";
      setTimeout(() => {
        delete copyButton.dataset.copied;
        copyButton.textContent = "Copy";
      }, 1400);
    });
    return;
  }
  interceptLinkClicks(event);
}

function useActiveHeading(headings: MarkdownHeading[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const elements = headings.map((heading) => document.getElementById(heading.id)).filter((element): element is HTMLElement => !!element);
    const onScroll = () => {
      const line = 120;
      let current: string | null = null;
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= line) current = element.id;
        else break;
      }
      setActive(current ?? elements[0]?.id ?? null);
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, [headings]);
  return active;
}

export function DocsSidebar({ current, open, onNavigate }: { current: string; open: boolean; onNavigate: () => void }) {
  return (
    <nav className="docs-sidebar" aria-label="Documentation" data-open={open || undefined} onClick={(event) => (event.target as HTMLElement).closest("a") && onNavigate()}>
      {DOC_SECTIONS.map((section) => (
        <div key={section.title}>
          <h2>{section.title}</h2>
          <ul>
            {section.pages.map((page) => (
              <li key={page.slug}>
                <Link to={`/docs/${page.slug}`} aria-current={page.slug === current ? "page" : undefined}>
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocPage({ slug }: { slug: string }) {
  const entry = ALL_DOCS.find((doc) => doc.slug === slug);
  const [loaded, setLoaded] = useState<{ slug: string; page: MarkdownPage } | null>(() => {
    const cached = cachedDocPage(slug);
    return cached ? { slug, page: cached } : null;
  });
  const page = loaded?.slug === slug ? loaded.page : cachedDocPage(slug);
  const [menuOpen, setMenuOpen] = useState(false);
  const toc = useMemo(() => (page?.headings ?? []).filter((heading) => heading.depth <= 3), [page]);
  const active = useActiveHeading(toc);

  useEffect(() => {
    setMenuOpen(false);
    let cancelled = false;
    void loadDocPage(slug).then((loadedPage) => {
      if (!cancelled && loadedPage) setLoaded({ slug, page: loadedPage });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  useEffect(() => {
    // Deep links: scroll to the heading once the page has rendered.
    if (page && location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  }, [page]);

  if (!entry) return <NotFound />;
  const index = ALL_DOCS.indexOf(entry);
  const previous = ALL_DOCS[index - 1];
  const next = ALL_DOCS[index + 1];

  return (
    <div className="docs-layout">
      <DocsSidebar current={slug} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <main className="docs-main" id="main">
        <button type="button" className="mobile-docs-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <MenuIcon /> {sectionOf(entry)} <span className="muted">›</span> {entry.title}
        </button>
        <header className="page-header">
          <p className="eyebrow">{sectionOf(entry)}</p>
          <h1>{page?.title || entry.title}</h1>
          {entry.repoFile && (
            <a className="source-link" href={`${REPOSITORY_URL}/blob/main/${entry.repoFile}`} target="_blank" rel="noreferrer">
              Also in the repository: {entry.repoFile}
            </a>
          )}
        </header>
        {page ? (
          <article className="prose" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: page.html }} />
        ) : (
          <div className="prose-loading" aria-busy="true" />
        )}
        <nav className="pager" aria-label="Previous and next page">
          {previous && (
            <Link to={`/docs/${previous.slug}`}>
              <span>Previous</span>
              {previous.title}
            </Link>
          )}
          {next && (
            <Link to={`/docs/${next.slug}`} className="next">
              <span>Next</span>
              {next.title}
            </Link>
          )}
        </nav>
      </main>
      {toc.length > 1 && (
        <aside className="toc" aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {toc.map((heading) => (
              <li key={heading.id}>
                <a href={`#${heading.id}`} className={`depth-${heading.depth}`} data-active={heading.id === active || undefined}>
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
