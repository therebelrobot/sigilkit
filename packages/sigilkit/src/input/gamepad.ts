import { Emitter, type Vec2, type World } from "../core/index";
import { Navigator, setInputMode, type NavigatorOptions } from "./navigator";

/** Standard-mapping gamepad buttons, named for an Xbox layout. */
export const BUTTONS = [
  "a", "b", "x", "y", "lb", "rb", "lt", "rt", "view", "menu", "ls", "rs", "up", "down", "left", "right", "guide",
] as const;
export type Button = (typeof BUTTONS)[number];

/** A plain-data read of one gamepad, so logic can be tested without the Gamepad API. */
export interface PadSnapshot {
  id: string;
  /** 0..1 per button (triggers are analog). */
  buttons: Partial<Record<Button, number>>;
  /** [leftX, leftY, rightX, rightY], -1..1. */
  axes: number[];
}

export interface PadButtonEvent {
  button: Button;
  pressed: boolean;
  pad: PadSnapshot;
}

export interface GamepadEvents extends Record<string, unknown> {
  button: PadButtonEvent;
  connected: { id: string };
  disconnected: { id: string };
}

export interface GamepadOptions extends NavigatorOptions {
  /** Stick deadzone. Default 0.35. */
  deadzone?: number;
  /** Held d-pad/stick repeat for menus, ms. Default 220. */
  repeatMs?: number;
  /**
   * Called for every press/release before the defaults. Return true to consume it,
   * e.g. while a game mode (a spell distaff, a map) owns the face buttons.
   */
  onButton?: (e: PadButtonEvent, world: World) => boolean | void;
  /** Called every frame. Return true to suppress default movement and focus this frame. */
  onFrame?: (pad: PadSnapshot, world: World) => boolean | void;
}

const PRESSED = 0.5;

/**
 * Default controls:
 *   left stick / d-pad  walk (one tile per step, any projection) · move choice cursor
 *   A                   act on focus with its default verb · advance dialog · confirm choice
 *   X                   look at focus
 *   B                   clear focus · drop held item · advance dialog
 *   LB / RB             cycle focus between nearby targets
 * Everything else (Y, triggers, view, menu, sticks) is free for the game via onButton.
 */
export class GamepadController {
  readonly world: World;
  readonly nav: Navigator;
  readonly events = new Emitter<GamepadEvents>();
  #opts: Required<Omit<GamepadOptions, keyof NavigatorOptions | "onButton" | "onFrame">> & GamepadOptions;
  #prev: Partial<Record<Button, boolean>> = {};
  #repeatAt = 0;
  #clock = 0;
  #lastId: string | null = null;

  constructor(world: World, options: GamepadOptions = {}) {
    this.world = world;
    this.nav = new Navigator(world, options);
    this.#opts = { deadzone: 0.35, repeatMs: 220, ...options };
  }

  /** Feed one frame. `pad` is null when no gamepad is connected. */
  frame(pad: PadSnapshot | null, deltaMs: number): void {
    this.#clock += deltaMs;
    if (!pad) {
      if (this.#lastId) this.events.emit("disconnected", { id: this.#lastId });
      this.#lastId = null;
      this.#prev = {};
      return;
    }
    if (pad.id !== this.#lastId) {
      this.#lastId = pad.id;
      this.events.emit("connected", { id: pad.id });
    }

    let active = false;
    for (const b of BUTTONS) {
      const down = (pad.buttons[b] ?? 0) > PRESSED;
      if (down === Boolean(this.#prev[b])) continue;
      this.#prev[b] = down;
      active = true;
      const e: PadButtonEvent = { button: b, pressed: down, pad };
      this.events.emit("button", e);
      if (this.#opts.onButton?.(e, this.world)) continue;
      if (down) this.#press(b);
    }

    const move = this.#moveVector(pad);
    if (move || active) setInputMode("gamepad");
    if (this.#opts.onFrame?.(pad, this.world)) return;

    const ui = this.world.ui.get();
    if (ui.choices.length && move && Math.abs(move.y) > 0.5) {
      if (this.#clock >= this.#repeatAt) {
        this.world.moveChoice(move.y > 0 ? 1 : -1);
        this.#repeatAt = this.#clock + this.#opts.repeatMs;
      }
    } else if (!move) {
      this.#repeatAt = 0;
    }
    this.nav.update(move);
  }

  #press(b: Button): void {
    switch (b) {
      case "a":
        return this.nav.confirm();
      case "x":
        return this.nav.verb("look");
      case "b":
        return this.nav.cancel();
      case "rb":
        return this.nav.cycle(1);
      case "lb":
        return this.nav.cycle(-1);
    }
  }

  /** Left stick, else d-pad, as a screen-space vector; null inside the deadzone. */
  #moveVector(pad: PadSnapshot): Vec2 | null {
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (Math.hypot(x, y) > this.#opts.deadzone) return { x, y };
    const dx = (pad.buttons.right ?? 0) - (pad.buttons.left ?? 0);
    const dy = (pad.buttons.down ?? 0) - (pad.buttons.up ?? 0);
    return dx || dy ? { x: dx, y: dy } : null;
  }
}

export function snapshotOf(gp: Gamepad): PadSnapshot {
  const buttons: Partial<Record<Button, number>> = {};
  BUTTONS.forEach((name, i) => {
    const b = gp.buttons[i];
    if (b) buttons[name] = b.value || (b.pressed ? 1 : 0);
  });
  return { id: gp.id, buttons, axes: [...gp.axes] };
}

/**
 * Poll the first connected standard-mapping gamepad every animation frame and
 * drive the world with it. Returns the controller (for events) and a stop function.
 */
export function startGamepad(world: World, options: GamepadOptions = {}): { controller: GamepadController; stop: () => void } {
  const controller = new GamepadController(world, options);
  let raf = 0;
  let last = performance.now();
  const loop = (now: number) => {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p): p is Gamepad => !!p && p.connected && (p.mapping === "standard" || p.buttons.length >= 16));
    controller.frame(gp ? snapshotOf(gp) : null, now - last);
    last = now;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return { controller, stop: () => cancelAnimationFrame(raf) };
}
