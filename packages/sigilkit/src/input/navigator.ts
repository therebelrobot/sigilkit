import { Store, type Vec2, type VerbId, type World } from "../core/index";

export interface NavigatorOptions {
  /** Auto-focus the nearest target within this many tiles (room tile widths). Default 5. */
  focusRangeTiles?: number;
}

export type InputMode = "gamepad" | "keyboard" | "pointer";

/**
 * Which device the player used last, for showing the right button prompts.
 * Gamepad drivers report themselves; call trackPointerAndKeyboard() for the rest.
 */
export const inputMode = new Store<{ mode: InputMode }>({ mode: "gamepad" });

export function setInputMode(mode: InputMode): void {
  inputMode.set({ mode });
}

/**
 * Device-independent "couch" controls for a World: move in a screen direction,
 * focus nearby targets, act on them, and drive dialog. Gamepad and keyboard
 * drivers translate raw input into these calls.
 */
export class Navigator {
  readonly world: World;
  #opts: Required<NavigatorOptions>;
  /** True after the player cycled focus by hand; auto-focus pauses until they walk away. */
  #manual = false;

  constructor(world: World, options: NavigatorOptions = {}) {
    this.world = world;
    this.#opts = { focusRangeTiles: 5, ...options };
  }

  get #range(): number {
    return this.#opts.focusRangeTiles * this.world.room.tile.width;
  }

  /** What a confirm press does right now: advance, choose, or act on focus. */
  confirm(): void {
    const ui = this.world.ui.get();
    if (ui.line) return this.world.advance();
    if (ui.choices.length) return this.world.confirmChoice();
    if (!ui.busy) void this.world.activateFocus();
  }

  /** Use a specific verb on the focused target (e.g. look). */
  verb(verb: VerbId): void {
    const ui = this.world.ui.get();
    if (ui.line) return this.world.advance();
    if (!ui.busy && !ui.choices.length) void this.world.activateFocus(verb);
  }

  cancel(): void {
    const ui = this.world.ui.get();
    if (ui.line) return this.world.advance();
    if (ui.heldItem) return this.world.holdItem(null);
    this.#manual = false;
    this.world.setFocus(null);
  }

  /** Next/previous focus target, or choice when choices are showing. */
  cycle(step: number): void {
    const ui = this.world.ui.get();
    if (ui.choices.length) return this.world.moveChoice(step);
    if (ui.busy) return;
    this.#manual = true;
    this.world.focusNext(step, this.#range);
  }

  /**
   * Per-frame update with the current movement vector (screen space, length 0..1).
   * Walks one tile at a time while held, and keeps focus on something nearby.
   */
  update(move: Vec2 | null): void {
    const ui = this.world.ui.get();
    // Focus is for gamepad/keyboard play; a pointer user targets things directly.
    if (inputMode.get().mode === "pointer") {
      if (ui.focus && !this.#manual) this.world.setFocus(null);
      return;
    }
    if (ui.line || ui.choices.length || ui.busy) return;
    if (move && Math.hypot(move.x, move.y) > 0) void this.world.stepToward(this.world.player, move);
    this.#autoFocus(Boolean(move && Math.hypot(move.x, move.y) > 0));
  }

  #autoFocus(moving: boolean): void {
    const near = this.world.targetsNear(this.world.player, this.#range);
    const current = this.world.ui.get().focus;
    const stillNear = current && near.some((t) => t.id === current);
    if (this.#manual) {
      if (stillNear) return;
      this.#manual = false;
    }
    // While walking, follow the nearest thing; when standing still, keep focus steady.
    if (!moving && stillNear) return;
    const nearest = near[0]?.id ?? null;
    if (nearest !== current) this.world.setFocus(nearest);
  }
}

export function trackPointerAndKeyboard(target: Window = window): () => void {
  const pointer = () => setInputMode("pointer");
  const key = () => setInputMode("keyboard");
  target.addEventListener("pointerdown", pointer);
  target.addEventListener("keydown", key);
  return () => {
    target.removeEventListener("pointerdown", pointer);
    target.removeEventListener("keydown", key);
  };
}
