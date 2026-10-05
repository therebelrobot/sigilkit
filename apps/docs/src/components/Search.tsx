import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { searchablePage, sectionOf } from "../content/registry";
import { href, navigate } from "../router";
import { ALL_DOCS, ALL_LESSONS } from "../site";

interface SearchEntry {
  path: string;
  /** Where it lives: "Docs › Rooms and walkmaps" */
  trail: string;
  title: string;
  text: string;
}

function buildIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const doc of ALL_DOCS) {
    const page = searchablePage(doc.slug);
    if (!page) continue;
    for (const section of page.sections) {
      entries.push({
        path: `/docs/${doc.slug}${section.id ? `#${section.id}` : ""}`,
        trail: `${sectionOf(doc)} › ${doc.title}`,
        title: section.heading || doc.title,
        text: section.text,
      });
    }
  }
  ALL_LESSONS.forEach((lesson, index) =>
    entries.push({ path: `/learn/${lesson.slug}`, trail: `Learn › Lesson ${index + 1}`, title: lesson.title, text: lesson.summary }),
  );
  return entries;
}

function score(entry: SearchEntry, words: string[]): number {
  const title = entry.title.toLowerCase();
  const text = entry.text.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (title.includes(word)) total += title.startsWith(word) ? 12 : 8;
    else if (entry.trail.toLowerCase().includes(word)) total += 3;
    else if (text.includes(word)) total += 1;
    else return 0;
  }
  return total;
}

function highlight(text: string, words: string[]): ReactNode {
  if (!words.length) return text;
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

function snippet(text: string, words: string[]): string {
  const lower = text.toLowerCase();
  const at = Math.min(...words.map((word) => lower.indexOf(word)).filter((index) => index >= 0), Infinity);
  if (!Number.isFinite(at)) return text.slice(0, 140);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? "…" : ""}${text.slice(start, start + 160)}`;
}

/** ⌘K / Ctrl+K search over every docs section and lesson. */
export function Search({ open, onClose }: { open: boolean; onClose: () => void }) {
  const index = useMemo(buildIndex, []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(() => {
    if (!words.length) return [];
    return index
      .map((entry) => ({ entry, score: score(entry, words) }))
      .filter((result) => result.score > 0)
      .sort((first, second) => second.score - first.score)
      .slice(0, 12)
      .map((result) => result.entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, query]);

  useEffect(() => {
    if (open) {
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open]);
  useEffect(() => setSelected(0), [query]);

  if (!open) return null;

  const go = (entry: SearchEntry) => {
    onClose();
    navigate(entry.path);
  };

  return (
    <div className="search-backdrop" onPointerDown={onClose}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search the docs" onPointerDown={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search docs and lessons…"
          aria-label="Search"
          aria-controls="search-results"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelected((value) => Math.min(value + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelected((value) => Math.max(value - 1, 0));
            }
            if (event.key === "Enter" && results[selected]) go(results[selected]);
          }}
        />
        {words.length > 0 &&
          (results.length ? (
            <ul className="search-results" id="search-results" role="listbox">
              {results.map((entry, resultIndex) => (
                <li key={entry.path + resultIndex}>
                  <a
                    href={href(entry.path.split("#")[0]!) + (entry.path.includes("#") ? `#${entry.path.split("#")[1]}` : "")}
                    role="option"
                    aria-selected={resultIndex === selected}
                    onMouseEnter={() => setSelected(resultIndex)}
                    onClick={(event) => {
                      event.preventDefault();
                      go(entry);
                    }}
                  >
                    <span className="result-path">{entry.trail}</span>
                    <div className="result-title">{highlight(entry.title, words)}</div>
                    <span className="result-snippet">{highlight(snippet(entry.text, words), words)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="search-empty">Nothing matches “{query}”.</p>
          ))}
      </div>
    </div>
  );
}
