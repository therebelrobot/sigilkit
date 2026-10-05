# Quick start

This page builds a playable room from an empty folder: a greenhouse with a planter to look at and a robot to talk to. It takes about five minutes. You'll need Node 24 or later.

## 1. Create the project

```sh
npm create vite@latest greenhouse -- --template react-ts
cd greenhouse
npm install sigilkit pixi.js inkjs
```

Add the [Phaser shim](/docs/installation#the-grid-engine-and-phaser-shim), then the Ink plugin in `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { ink } from "sigilkit/story/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react(), ink()] });
```

And declare `.ink` imports in `src/vite-env.d.ts`:

```ts
declare module "*.ink" {
  const json: string;
  export default json;
}
```

## 2. Write the game

`src/game.ts` holds content only: no imports of art, no DOM. Keeping it that way means a server or a test can load the same file.

```ts
import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  // '.' floor, '#' wall, any other letter is blocked floor under furniture.
  walkmap: [
    "####################",
    "####################",
    "#..................#",
    "#..pp..............#",
    "#..pp..............#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  entries: { start: { at: { x: 6, y: 7 }, facing: "right" } },
  actors: { moth: { at: { x: 12, y: 6 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "planter",
      name: "dry planter",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 3, 3, 2, 2, 6),
      standAt: { x: 4, y: 5 },
      face: "up",
      verbs: { look: "planter_look", use: "planter_use" },
    },
  ],
});

export const game = defineGame({
  title: "Greenhouse",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk" } },
  },
  rooms: { greenhouse },
  fallback: () => "Nothing interesting.",
});
```

## 3. Write the story

`src/story/main.ink`. Each knot is a handler that a verb string above points to:

```ink
=== planter_look ===
Wren: The soil's cracked like an old circuit board.
-> END

=== planter_use ===
Wren: I need something to water it with.
-> END

=== moth_talk ===
Moth: Oh! A visitor. Mind the seedlings.
* [Who are you?]
    Moth: Greenhouse custodian, model M-07.
* [Bye.]
- Moth: Come back any time.
-> END
```

## 4. Wire it up

Replace `src/App.tsx`:

```tsx
import { World } from "sigilkit";
import { startGamepad, startKeyboard } from "sigilkit/input";
import { placeholderActor } from "sigilkit/pixi";
import { GameProvider, GameShell, Stage } from "sigilkit/react";
import "sigilkit/react/styles.css";
import { InkRunner } from "sigilkit/story";
import { game } from "./game";
import story from "./story/main.ink";

const world = new World(game);
new InkRunner(world, story);
world.start();
startKeyboard(world);
startGamepad(world);

const colors: Record<string, number> = { wren: 0xf3d27a, moth: 0x9fe0d4 };

export default function App() {
  return (
    <GameProvider world={world}>
      <GameShell stage={<Stage actors={(sprite) => placeholderActor(colors[sprite] ?? 0xffffff)} />} />
    </GameProvider>
  );
}
```

Remove Vite's default `index.css` import from `main.tsx`, since `GameShell` fills the window itself.

## 5. Play

```sh
npm run dev
```

Click to walk. Click the planter to look at it, pick **Use** from the verb bar and click it again, and click Moth to talk. Right-click (or long-press) for the verb coin. The arrow keys and a gamepad work too.

## Where next

- Add a second room and a door: [Moving between rooms](/learn/rooms).
- Replace the placeholders with art: [Rendering](/docs/rendering) and [Visual design](/docs/visual-design).
- Add music and sound: [Audio](/docs/audio).
- Stop guessing whether a room works: [Testing headlessly](/docs/testing).
- Follow the [Learn](/learn) path for a guided tour of every feature.
