# Gamepad and keyboard

`sigilkit/input` adds cursor-free **couch controls**: walk with a stick or arrow keys, keep focus on whatever's nearby, and act on it with one button. It works alongside pointer play, and the player can switch at any moment.

```ts
import { startGamepad, startKeyboard, trackPointerAndKeyboard } from "sigilkit/input";

const keyboard = startKeyboard(world);
const gamepad = startGamepad(world);
trackPointerAndKeyboard(); // so prompts know when the player switches back to the mouse
```

No peers. Both drivers return `stop()`.

## Default controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Walk | Arrows, WASD | Left stick, d-pad |
| Use focus (default verb) · advance dialog · confirm choice | Enter, Space, E | A |
| Look at focus | L | X |
| Next / previous target | Tab, `]` / Shift-Tab, `[` | RB / LB |
| Clear focus · drop held item · advance dialog | Escape, Backspace | B |
| Move choice cursor | Up, Down | Stick, d-pad |

Y, the triggers, view, menu and the stick clicks are left free for the game.

## Navigator

Both drivers translate raw input into a `Navigator`, the device-independent part:

| Method | Does |
| --- | --- |
| `update(direction \| null)` | Per frame: step toward a screen direction, and keep focus on something nearby |
| `confirm()` | Advance dialog, confirm a choice, or use the focused target's default verb |
| `verb(verb)` | Use a specific verb on the focus |
| `cycle(step)` | Next or previous focus target, or move the choice cursor |
| `cancel()` | Advance dialog, put away the held item, or clear focus |

Write a driver for anything else (a touch D-pad, a MIDI controller, an accessibility switch) on the same object.

## Walking in screen space

`world.stepToward(actor, { x, y })` takes one step toward a **screen** direction, choosing the walkable neighbour whose on-screen direction is closest. Up means up on screen in any projection. In isometric rooms, set `directions: 8` so that's one diagonal step. Pushing toward a stair landing climbs.

## Focus

While walking, focus follows the nearest hotspot or verb-bearing actor within `focusRangeTiles` (default 5). Cycling by hand pins it until you walk out of range. `ui.focus` holds the id, the renderer outlines it (`showFocus`, `focusColor`), and `SentenceLine` names it. Focus switches off while the player uses a pointer.

## Options

```ts
startKeyboard(world, {
  bindings: { up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"] }, // drop WASD
  onKey: (event, world) => { /* return true to consume */ },
  focusRangeTiles: 6,
});

startGamepad(world, {
  deadzone: 0.35,
  repeatMs: 220, // held stick repeat in menus
  onButton: (event, world) => { /* { button, pressed, pad }; return true to consume */ },
  onFrame: (pad, world) => { /* return true to suppress movement this frame */ },
  focusRangeTiles: 6,
});
```

Keyboard actions: `up down left right confirm look next prev cancel`. Bindings are `KeyboardEvent.key` values, case-insensitive, merged over `DEFAULT_KEYS`. Keys typed into inputs and text areas are ignored.

Gamepad buttons (standard mapping, Xbox names): `a b x y lb rb lt rt view menu ls rs up down left right guide`.

## Game modes

Games always have controls of their own. Hook in rather than fork:

```ts
startGamepad(world, {
  // While LT is held, the face buttons play notes instead of acting.
  onButton: (event) => {
    if (event.button === "lt") return (spellMode = event.pressed), true;
    if (spellMode && event.pressed && ["a", "b", "x", "y"].includes(event.button)) return playNote(event.button), true;
    return false;
  },
  onFrame: () => spellMode, // the stick doesn't walk while casting
});
```

`startGamepad` also returns its `controller`, whose `events` emit `button`, `connected` and `disconnected`.

## Prompts

`inputMode` is a store of the last device used: `"gamepad"`, `"keyboard"` or `"pointer"`. Drivers report themselves, and `trackPointerAndKeyboard()` covers the mouse and touch. Read it to show matching glyphs:

```tsx
const { mode } = useSyncExternalStore(inputMode.subscribe, inputMode.get);
return <kbd>{mode === "gamepad" ? "Ⓐ" : "Enter"}</kbd>;
```

## Testing

Gamepad logic runs on plain snapshots, so it's testable without a browser:

```ts
const controller = new GamepadController(world);
controller.frame({ id: "test", buttons: { a: 1 }, axes: [0, 0] }, 16);
```

`snapshotOf(gamepad)` converts a real `Gamepad` into a `PadSnapshot`.
