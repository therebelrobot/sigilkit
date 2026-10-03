import type { World } from "./world";

export type CommandFn = (args: string[], world: World) => void | Promise<void>;

/**
 * Split a command line into tokens. Double-quoted spans stay together:
 * `say moth "the door is stuck"` -> ["say", "moth", "the door is stuck"]
 */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  for (const m of line.matchAll(re)) out.push(m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]!);
  return out;
}

export function parseValue(raw: string): string | number | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
}

/** The commands every game gets. Register more with world.commands.set(). */
export function builtinCommands(): Map<string, CommandFn> {
  const num = (s: string | undefined, name: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`expected a number for ${name}, got "${s}"`);
    return n;
  };
  return new Map<string, CommandFn>([
    ["walk", async ([id, x, y], w) => void (await w.walk(id!, { x: num(x, "x"), y: num(y, "y") }))],
    ["face", ([id, dir], w) => w.face(id!, dir as never)],
    ["say", async ([speaker, ...text], w) => w.say(speaker === "-" ? null : speaker!, text.join(" "))],
    ["wait", async ([ms], w) => w.wait(num(ms, "ms"))],
    ["goto", async ([room, entry], w) => w.goto(room!, entry)],
    ["give", ([item], w) => w.give(item!)],
    ["take", ([item], w) => w.take(item!)],
    ["set", ([flag, value], w) => w.setFlag(flag!, parseValue(value ?? "true"))],
    ["show", ([id], w) => w.setVisible(id!, true)],
    ["hide", ([id], w) => w.setVisible(id!, false)],
    ["place", ([id, x, y], w) => w.place(id!, { x: num(x, "x"), y: num(y, "y") })],
    ["music", ([key], w) => w.events.emit("music", { key: key ?? null })],
    ["sfx", ([key], w) => w.events.emit("sfx", { key: key! })],
  ]);
}
