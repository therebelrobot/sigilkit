import { useRef } from "react";
import { highlightInk, highlightWalkmap } from "../highlight/ink";
import type { FileLanguage } from "../lessons/types";

/**
 * A plain textarea over its own highlighted copy: light, accessible, and enough
 * for editing a story or a walkmap.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  onRun,
}: {
  value: string;
  onChange: (value: string) => void;
  language: FileLanguage;
  label: string;
  onRun?: () => void;
}) {
  const highlightRef = useRef<HTMLPreElement>(null);
  const html = language === "walkmap" ? highlightWalkmap(value) : highlightInk(value);
  return (
    <div className={`code-editor ${language}`}>
      <pre ref={highlightRef} className="code-editor-highlight" aria-hidden="true">
        {/* Trailing newline keeps the overlay's height in step with the textarea's last line. */}
        <code dangerouslySetInnerHTML={{ __html: `${html}\n` }} />
      </pre>
      <textarea
        aria-label={label}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (!highlightRef.current) return;
          highlightRef.current.scrollTop = event.currentTarget.scrollTop;
          highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onRun?.();
          }
          // Tab inserts two spaces; Escape then Tab leaves the editor (no keyboard trap).
          if (event.key === "Tab" && !event.shiftKey && !event.currentTarget.dataset.escaped) {
            event.preventDefault();
            const textarea = event.currentTarget;
            const { selectionStart, selectionEnd } = textarea;
            onChange(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`);
            requestAnimationFrame(() => textarea.setSelectionRange(selectionStart + 2, selectionStart + 2));
          }
          if (event.key === "Escape") event.currentTarget.dataset.escaped = "true";
          else if (event.key !== "Tab") delete event.currentTarget.dataset.escaped;
        }}
      />
    </div>
  );
}
