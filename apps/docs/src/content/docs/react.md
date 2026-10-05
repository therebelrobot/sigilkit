# React UI

`sigilkit/react` connects a `World` to React: a context provider, a `<Stage>` that mounts the Pixi renderer, hooks over the world's UI state, and a set of plain default components you can keep, restyle or replace.

```tsx
import { GameProvider, GameShell, Stage } from "sigilkit/react";
import "sigilkit/react/styles.css";

export const App = () => (
  <GameProvider world={world}>
    <GameShell stage={<Stage actors={actors} />} />
  </GameProvider>
);
```

Needs the `react` peer (React 19).

## GameProvider

`<GameProvider world={world}>` makes the world (and, once mounted, its renderer) available to everything inside. Every hook and component must be under one.

## Stage

`<Stage>` mounts the Pixi renderer into a `div` that fills its parent. It takes every [renderer option](/docs/rendering#options) except `host`, plus:

| Prop | Meaning |
| --- | --- |
| `className`, `style` | For the host `div` |
| `onFirstGesture` | Called on the first pointer press. Resume audio here: `() => void audio.unlock()` |
| `onAltPress` | Replace the verb coin with your own long-press/right-click handling |

The renderer is created once per world. Changing options later goes through the renderer API (`useRenderer()?.setDebug(true)`), not by re-rendering `<Stage>` with new props.

## Hooks

| Hook | Returns |
| --- | --- |
| `useWorld()` | The `World` |
| `useRenderer()` | The `Renderer`, or `null` until it's created |
| `useUi()` | The full `UiState` snapshot. Re-renders when it changes |
| `useDialog()` | `{ line, choices, advance(), choose(index) }` |
| `useVerbs()` | `{ verbs, verb, setVerb(verb) }` |
| `useInventory()` | `{ items: { id, name, icon }[], held, hold(id \| null) }` |

### UiState

| Field | Meaning |
| --- | --- |
| `line` | `{ speaker, text, tags }` being spoken, or `null` |
| `choices` | `{ index, text }[]` on offer |
| `verb` | Selected verb |
| `heldItem` | Item in hand, or `null` |
| `hover` | Name of what's under the pointer |
| `focus` | Hotspot or actor id targeted by keyboard/gamepad |
| `choiceIndex` | Keyboard/gamepad choice cursor |
| `busy` | A script is running, and world input is ignored |
| `inventory` | Item ids |
| `room` | Current room id |

`world.ui` is a framework-free store (`get()`, `subscribe(fn)`), so Vue, Svelte or plain DOM UIs read it the same way.

## Components

All are unstyled apart from layout essentials, and each takes a `className` (with a stable `vc-*` default).

| Component | Renders |
| --- | --- |
| `GameShell` | The responsive layout: stage on top, UI docked below in portrait, overlaid on short landscape phones. Children replace the default UI |
| `DialogBox` | The current line, with the speaker's name in their colour. Click to advance. `aria-live` for screen readers |
| `ChoiceList` | Dialog choices. `aria-current` marks the keyboard/gamepad cursor |
| `SentenceLine` | "Use watering can with dry planter" |
| `VerbBar` | Verb buttons. `labels` renames them: `{ look: "Look at" }` |
| `InventoryBar` | Items. `renderIcon={(item) => <img src={…} />}` draws icons |
| `VerbCoin` | Radial verb picker at the long-press point. `radius` sets its size |

`GameShell` with no children renders `DialogBox`, `ChoiceList`, `SentenceLine`, `VerbBar` and `InventoryBar`, plus the `VerbCoin`.

## Replacing the UI

Pass children to `GameShell` to replace the default UI, or skip `GameShell` and lay out the page yourself, since `<Stage>` only needs a sized parent:

```tsx
<GameProvider world={world}>
  <GameShell stage={<Stage actors={actors} overheadSpeech />}>
    <MyVerbGrid />
    <MyInventory />
  </GameShell>
</GameProvider>
```

The [Your own UI](/learn/custom-ui) lesson builds a complete SCUMM-style interface from the hooks.

## Styling

`sigilkit/react/styles.css` is a starting look. Every rule targets a `vc-*` class and reads custom properties set on `.vc-shell`:

```css
.vc-shell {
  --vc-bg: #0d1412;      /* letterbox and page */
  --vc-panel: #16211e;   /* UI panel, dialog box */
  --vc-ink: #e9efe6;     /* text */
  --vc-muted: #8ea398;   /* secondary text, borders */
  --vc-accent: #c8e86a;  /* selection, focus, sentence line */
  --vc-font: ui-monospace, Menlo, monospace;
}
```

Override those for a quick reskin, or write your own stylesheet against the same classes. `.vc-shell` is `position: fixed; inset: 0` so a game fills the window. Override that to embed one in a page.

## Accessibility

- `DialogBox` is a DOM element, so it scales with the system font size and is announced by screen readers. Prefer it to `overheadSpeech` unless you offer both.
- Every control is a real `button` with `aria-pressed` and `aria-current` states, and the verb and inventory bars are labelled toolbars.
- Couch controls (`sigilkit/input`) make the game playable without a pointer.
