# Keyboard and gamepad

Point-and-click works with a mouse and with touch, but plenty of people would rather play from the sofa. `sigilkit/input` adds **couch controls**: walk with a stick or the arrow keys, focus whatever's nearby, and act on it with one button. No cursor needed.

Click the demo once so it has keyboard focus (its border lights up). Then walk with the arrow keys or WASD. As you get near things, the nearest one is outlined: that's **focus**. Press Enter to use it, L to look at it, and `]` to cycle to the next target. Press H to hum, which is a game-specific key. A connected gamepad works too: stick to walk, A to use, X to look, LB and RB to cycle, Y to hum.

## Starting the drivers

```ts
import { startGamepad, startKeyboard } from "sigilkit/input";

const keyboard = startKeyboard(world);
const gamepad = startGamepad(world);
// later: keyboard.stop(); gamepad.stop();
```

Both drive a `Navigator`, the device-independent part that knows how to walk in a screen direction, keep focus on something nearby, and act on it. They only translate keys and buttons into calls on it.

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Walk | Arrows, WASD | Left stick, d-pad |
| Use focus (default verb), advance dialog, confirm choice | Enter, Space, E | A |
| Look at focus | L | X |
| Cycle focus | Tab, `]` (Shift-Tab, `[`) | RB, LB |
| Clear focus, drop held item | Escape, Backspace | B |
| Move choice cursor | Up, Down | Stick, d-pad |

Rebind any action with `bindings`. A game that needs letter keys for something else can drop WASD: `bindings: { up: ["ArrowUp"], … }`. These docs move Tab to `]` so Tab still leaves the demo for the next thing on the page.

## Walking in screen space

`world.stepToward(actor, direction)` moves one tile toward a **screen-space** direction, choosing the walkable neighbour whose on-screen direction is closest. Pressing up means up on screen in an orthogonal room and in an isometric one. For isometric rooms, set `directions: 8` so that's a single diagonal step. On stairs, pushing toward the landing climbs.

## Focus

While you walk, focus follows the nearest hotspot or talkable actor within range (`focusRangeTiles`, default 5). Cycling by hand pins it until you walk away. The renderer outlines the focused target (`<Stage showFocus focusColor>`), and `ui.focus` holds its id for your UI. Focus switches off while the player is using a pointer.

## Game modes: onKey and onButton

Games always have controls of their own: a map button, a spell instrument, humming. Rather than forking the drivers, hook in:

- `onKey(event, world)` and `onButton(event, world)` see every key or button first. Return `true` to consume it.
- `onFrame(pad, world)` runs every gamepad frame. Return `true` to suppress default movement, for example while a mode owns the stick.

**controls.ts** uses these to add humming, and to ignore input when the game doesn't have focus (a docs page needs that, and so would a game with a chat box).

## Showing the right prompts

`inputMode` is a tiny store holding `"keyboard"`, `"gamepad"` or `"pointer"`, whichever the player used last. Gamepad and keyboard drivers update it, and `trackPointerAndKeyboard()` adds mouse and touch. **prompts.tsx** reads it to show matching button names under the demo. Try clicking, then pressing a key.

## Testing it

Gamepad logic runs on plain `PadSnapshot` objects (`{ id, buttons: { a: 1 }, axes: [x, y] }`), so `new GamepadController(world).frame(snapshot, ms)` is unit-testable without the browser's Gamepad API.

## What you learned

- `startKeyboard` and `startGamepad` add couch play: screen-space walking, focus and one-button acting.
- `onKey`, `onButton` and `onFrame` let a game add its own controls or take the pad over.
- `inputMode` tells your UI which device's prompts to show.
