# sigilkit

A composable 2D adventure engine for React, in the spirit of LucasArts' SCUMM: painted rooms, point-and-click verbs, Ink for story. Orthogonal and isometric rooms, desktop, mobile and controller play, and an optional multiplayer layer on Cloudflare PartyServer.

One package with subpath exports. Import only what you use; everything beyond the core is an optional peer dependency.

```sh
npm install sigilkit pixi.js react react-dom inkjs
```

| Import | What it is | Needs |
| --- | --- | --- |
| `sigilkit` | Headless world: rooms, actors, grid movement, hotspots, verbs, inventory, flags, commands, save/load. No DOM. | — |
| `sigilkit/story` | Ink runner: knots as handlers, `Name: line` speech, `>>> command` lines, VARs mirrored to flags | `inkjs` |
| `sigilkit/story/vite` | Vite plugin: `import story from "./main.ink"` | `vite` |
| `sigilkit/pixi` | PixiJS v8 renderer: backgrounds or blockout, depth-sorted actors and animated props, picking, scaling, camera | `pixi.js` |
| `sigilkit/react` | `<Stage>`, hooks, unstyled default UI; `sigilkit/react/styles.css` for a default look | `react` |
| `sigilkit/input` | Gamepad and keyboard play: stick walking, focus, dialog navigation, hooks for game modes | — |
| `sigilkit/audio` | Web Audio music crossfades, sfx, ducking under dialog | — |
| `sigilkit/net`, `/net/server`, `/net/client` | Multiplayer room on PartyServer, partysocket client, Better Auth verifiers | `partyserver`, `partysocket` |

## A room and a game

```ts
import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const base = {
  id: "greenhouse",
  projection: "orthogonal", // or "isometric" (add directions: 8 for stick play)
  tile: { width: 16, height: 16 },
  // '.' walkable, '#' wall, any other character blocked floor under furniture
  walkmap: [
    "####################",
    "#..................#",
    "#..###.......###...#",
  ],
  entries: { start: { at: { x: 4, y: 1 } } },
} satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...base,
  hotspots: [
    {
      id: "planter",
      name: "dry planter",
      shape: tileArea({ ...base, hotspots: [] }, 3, 2, 3, 1, 6),
      standAt: { x: 4, y: 1 },
      verbs: { look: "planter_look", use: "planter_use" }, // Ink knots, or (ctx) => {...}
    },
  ],
});

export const game = defineGame({
  title: "Greenhouse",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  actors: { wren: { name: "Wren", sprite: "wren" } },
  rooms: { greenhouse },
});
```

```ink
=== planter_look ===
Wren: The soil's cracked like an old circuit board.
>>> walk wren 6 1
-> END
```

```tsx
import { World } from "sigilkit";
import { startGamepad } from "sigilkit/input";
import { placeholderActor } from "sigilkit/pixi";
import { GameProvider, GameShell, Stage } from "sigilkit/react";
import "sigilkit/react/styles.css";
import { InkRunner } from "sigilkit/story";
import story from "./main.ink"; // with ink() from sigilkit/story/vite in vite.config

const world = new World(game);
new InkRunner(world, story);
world.start();
startGamepad(world);

export const App = () => (
  <GameProvider world={world}>
    <GameShell stage={<Stage actors={() => placeholderActor(0xf3d27a)} />} />
  </GameProvider>
);
```

Rooms without background art render as a blockout from the walkmap, so a game is playable before any art exists.

Rooms can also stack floors (`levels`) joined by `stairs`, with characters of different heights (`ActorDef.height`) routing around anything too low for them. `areas` divide a room into named spaces: interiors that cut away while you're inside (front walls and roof fade, the outside is shaded), and attached rooms hidden under fog until first entered. See `docs/LEVEL_DESIGN.md` in the repository.

## One install note: grid-engine and Phaser

Movement and pathfinding come from [grid-engine](https://github.com/Annoraaq/grid-engine), which imports `phaser` at load even in headless use. That pulls all of Phaser into your bundle, and it crashes in Workers. Until that import is made lazy upstream, give your app a two-line stand-in:

```jsonc
// package.json
"dependencies": { "phaser": "file:./vendor/phaser-shim" }
```

```js
// vendor/phaser-shim/index.js  (with a package.json: name "phaser", version "4.0.0", type "module")
export const Tilemaps = { Orientation: { ORTHOGONAL: 0, ISOMETRIC: 1, STAGGERED: 2, HEXAGONAL: 3 } };
```

## More

Documentation, an API reference and interactive lessons with in-browser demos are at [therebelrobot.github.io/sigilkit](https://therebelrobot.github.io/sigilkit/).

Architecture, the interaction model, controls, multiplayer design and the roadmap are in the [repository](https://github.com/therebelrobot/sigilkit), along with a two-room demo (orthogonal and isometric) and a Worker hosting it for multiplayer.

## License

[Unlicense](https://unlicense.org/): public domain.
