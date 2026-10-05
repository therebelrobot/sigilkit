# Your own UI

sigilkit's default interface (dialog box, choices, sentence line, verb bar, inventory) is deliberately plain. It's meant to be replaced. This lesson replaces it with a classic look: speech over characters' heads, a three-by-two verb grid and inventory slots. It's the game from [Items](/learn/items) with a different UI.

Take the watering can and use it on the planter. The game plays the same, but every piece of interface is new.

## The world's UI state

Everything an interface needs is in one small store, `world.ui`:

```ts
interface UiState {
  line: DialogLine | null;   // the line being spoken (speaker, text, tags)
  choices: DialogChoice[];   // dialog choices on offer
  verb: string;              // the selected verb
  heldItem: string | null;   // the item in hand
  hover: string | null;      // name of what's under the pointer
  focus: string | null;      // target of keyboard or gamepad focus
  choiceIndex: number;       // keyboard and gamepad choice cursor
  busy: boolean;             // a script is running
  inventory: string[];
  room: string;
}
```

It works with React's `useSyncExternalStore`. It works just as well with Vue, Svelte or plain DOM code: `world.ui.subscribe(fn)` and `world.ui.get()`.

## Hooks

Inside `<GameProvider world={world}>`, `sigilkit/react` provides:

| Hook | Gives you |
| --- | --- |
| `useUi()` | the whole `UiState` snapshot |
| `useDialog()` | `line`, `choices`, `advance()`, `choose(index)` |
| `useVerbs()` | `verbs`, the current `verb`, `setVerb(verb)` |
| `useInventory()` | `items` (with names and icons), `held`, `hold(id \| null)` |
| `useWorld()` | the `World` itself |
| `useRenderer()` | the Pixi `Renderer`, once it exists |

**ui.tsx** builds the whole interface from these.

## Replacing the default UI

`GameShell` lays out the stage and docks the UI below it. Pass children to replace the default UI:

```tsx
<GameProvider world={world}>
  <GameShell stage={<Stage actors={actors} overheadSpeech />}>
    <ClassicUi />
  </GameShell>
</GameProvider>
```

`GameShell` is optional as well. `<Stage>` is a `div` that fills its parent, so you can lay out the page however you like. The default components are also available on their own (`DialogBox`, `ChoiceList`, `VerbBar`, `InventoryBar`, `SentenceLine`, `VerbCoin`) if you only want to replace some of them.

## Overhead speech

`<Stage overheadSpeech />` makes the renderer draw spoken lines above the speaker, SCUMM-style, and narration across the top. It's off by default because a DOM dialog box is easier to read on phones, scales with the system font size and reaches screen readers. If you turn it on, think about keeping a `DialogBox` for those players, or behind a setting.

## Styling the defaults

If you keep the default components, `sigilkit/react/styles.css` gives them a starting look. Every rule targets a stable `vc-*` class and reads `--vc-*` custom properties (`--vc-bg`, `--vc-panel`, `--vc-ink`, `--vc-muted`, `--vc-accent`, `--vc-font`), so restyling can be as small as five variables.

## What you learned

- `world.ui` holds all UI state, and the hooks read it inside `GameProvider`.
- `GameShell` children replace the default UI, and every default component is optional.
- `overheadSpeech` draws dialog in the scene, and `vc-*` classes restyle the defaults.
