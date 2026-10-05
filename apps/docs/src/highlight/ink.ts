/*
 * A small Ink highlighter, shared by the Markdown build step (```ink fences) and
 * the in-browser story editors. Shiki has no Ink grammar; this covers what
 * sigilkit stories use: knots, diverts, choices, logic, tags, `Name:` speakers
 * and `>>> command` lines. Output is HTML with `ink-*` classes.
 */

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const span = (className: string, text: string) => (text ? `<span class="ink-${className}">${escapeHtml(text)}</span>` : "");

const DECLARATION = /^(\s*)(VAR|CONST|LIST|INCLUDE|EXTERNAL|TODO:?)(\b.*)$/;
const KNOT = /^(\s*)(={2,})(\s*)(function\s+)?([\w.]+)(.*)$/;
const STITCH = /^(\s*)(=)(\s*)([\w.]+)(.*)$/;
const COMMAND = /^(\s*)(>>>)(.*)$/;
const LOGIC = /^(\s*)(~)(.*)$/;
const LEADING_MARKERS = /^(\s*)((?:[*+]\s*)+|(?:-(?!>)\s*)+)(\(\w+\)\s*)?/;
const SPEAKER = /^([A-Z][\w' ]{0,30}):(?=\s)/;

/** Highlight the content of a line after its leading structure (markers, speaker). */
function inline(text: string): string {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const rest = text.slice(index);
    if (rest.startsWith("//")) {
      out += span("comment", rest);
      break;
    }
    const divert = /^(<-|->->|->)(\s*)([\w.]*)/.exec(rest);
    if (divert) {
      out += span("divert", divert[1]!) + escapeHtml(divert[2]!) + span("target", divert[3]!);
      index += divert[0].length;
      continue;
    }
    if (rest[0] === "{") {
      // Logic braces; match nesting so `{a: {b}}` stays one span.
      let depth = 0;
      let end = 0;
      for (; end < rest.length; end++) {
        if (rest[end] === "{") depth++;
        else if (rest[end] === "}" && --depth === 0) break;
      }
      out += span("logic", rest.slice(0, end + 1));
      index += end + 1;
      continue;
    }
    if (rest[0] === "#") {
      out += span("tag", rest);
      break;
    }
    if (rest[0] === "[" || rest[0] === "]") {
      out += span("bracket", rest[0]);
      index++;
      continue;
    }
    const plain = /^[^/\-<{#[\]]+|^./.exec(rest)![0];
    out += escapeHtml(plain);
    index += plain.length;
  }
  return out;
}

export function highlightInkLine(line: string): string {
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//")) return span("comment", line);
  let match = DECLARATION.exec(line);
  if (match) return escapeHtml(match[1]!) + span("keyword", match[2]!) + inline(match[3]!);
  match = KNOT.exec(line);
  if (match) {
    return (
      escapeHtml(match[1]!) +
      span("knot", match[2]!) +
      escapeHtml(match[3]!) +
      span("keyword", match[4] ?? "") +
      span("name", match[5]!) +
      span("knot", match[6]!)
    );
  }
  match = STITCH.exec(line);
  if (match && !trimmed.startsWith("==")) return escapeHtml(match[1]!) + span("knot", match[2]!) + escapeHtml(match[3]!) + span("name", match[4]!) + inline(match[5]!);
  match = COMMAND.exec(line);
  if (match) return escapeHtml(match[1]!) + span("command-mark", match[2]!) + span("command", match[3]!);
  match = LOGIC.exec(line);
  if (match) return escapeHtml(match[1]!) + span("logic", match[2]!) + span("logic", match[3]!);

  let out = "";
  let rest = line;
  match = LEADING_MARKERS.exec(rest);
  if (match && match[2]) {
    out += escapeHtml(match[1]!) + span("choice", match[2]) + span("label", match[3] ?? "");
    rest = rest.slice(match[0].length);
  }
  // A choice line can carry a condition before its text: `* { not met } [Hello]`.
  const condition = /^(\{[^}]*\}\s*)/.exec(rest);
  if (condition) {
    out += span("logic", condition[1]!.trimEnd()) + escapeHtml(condition[1]!.slice(condition[1]!.trimEnd().length));
    rest = rest.slice(condition[0].length);
  }
  const speaker = SPEAKER.exec(rest);
  if (speaker) {
    out += span("speaker", speaker[0]);
    rest = rest.slice(speaker[0].length);
  }
  return out + inline(rest);
}

export function highlightInk(source: string): string {
  return source.split("\n").map(highlightInkLine).join("\n");
}

/** Walkmaps and areamaps: '.' floor, '#' wall, other characters furniture or area letters. */
export function highlightWalkmap(source: string): string {
  return source
    .split("\n")
    .map((line) =>
      line.trimStart().startsWith("//")
        ? span("comment", line)
        : [...line]
            .map((character) =>
              character === "." ? span("floor", ".") : character === "#" ? span("wall", "#") : character === " " ? " " : span("furniture", character),
            )
            .join(""),
    )
    .join("\n");
}
