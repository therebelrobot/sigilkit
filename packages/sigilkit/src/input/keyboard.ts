import type { Vec2, World } from "../core/index";
import { Navigator, type NavigatorOptions } from "./navigator";

export type KeyAction = "up" | "down" | "left" | "right" | "confirm" | "look" | "next" | "prev" | "cancel";

export interface KeyboardOptions extends NavigatorOptions {
  /** `KeyboardEvent.key` values per action (case-insensitive). Merged over the defaults. */
  bindings?: Partial<Record<KeyAction, string[]>>;
  /** Return true to consume a key before the defaults. */
  onKey?: (e: KeyboardEvent, world: World) => boolean | void;
}

export const DEFAULT_KEYS: Record<KeyAction, string[]> = {
  up: ["ArrowUp", "w"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  confirm: ["Enter", " ", "e"],
  look: ["l"],
  next: ["Tab", "]"],
  prev: ["["],
  cancel: ["Escape", "Backspace"],
};

/**
 * Keyboard play without a mouse: walk with arrows/WASD, cycle focus with Tab,
 * act with Enter/Space/E. Rebind any action; games that need letter keys (a
 * musical keyboard, say) can drop WASD with `bindings: { up: ["ArrowUp"], ... }`.
 */
export function startKeyboard(world: World, options: KeyboardOptions = {}, target: Window = window): { nav: Navigator; stop: () => void } {
  const nav = new Navigator(world, options);
  const keys = { ...DEFAULT_KEYS, ...options.bindings };
  const lookup = new Map<string, KeyAction>();
  for (const [action, list] of Object.entries(keys) as [KeyAction, string[]][]) {
    for (const k of list) lookup.set(k.toLowerCase(), action);
  }
  const held = new Set<KeyAction>();

  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (options.onKey?.(e, world)) return;
    const action = lookup.get(e.key.toLowerCase());
    if (!action) return;
    e.preventDefault();
    if (["up", "down", "left", "right"].includes(action)) {
      if (!held.has(action) && world.ui.get().choices.length && (action === "up" || action === "down"))
        world.moveChoice(action === "up" ? -1 : 1);
      held.add(action);
      return;
    }
    if (e.repeat) return;
    if (action === "confirm") nav.confirm();
    else if (action === "look") nav.verb("look");
    else if (action === "cancel") nav.cancel();
    else if (action === "next") nav.cycle(e.shiftKey ? -1 : 1);
    else if (action === "prev") nav.cycle(-1);
  };
  const up = (e: KeyboardEvent) => {
    const action = lookup.get(e.key.toLowerCase());
    if (action) held.delete(action);
  };
  const blur = () => held.clear();

  let raf = 0;
  const loop = () => {
    const move: Vec2 = {
      x: (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0),
      y: (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0),
    };
    nav.update(move.x || move.y ? move : null);
    raf = requestAnimationFrame(loop);
  };

  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  target.addEventListener("blur", blur);
  raf = requestAnimationFrame(loop);
  return {
    nav,
    stop: () => {
      cancelAnimationFrame(raf);
      target.removeEventListener("keydown", down);
      target.removeEventListener("keyup", up);
      target.removeEventListener("blur", blur);
    },
  };
}

function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
}
