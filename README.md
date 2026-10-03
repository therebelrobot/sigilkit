# sigilkit

A composable 2D adventure engine for React, in the spirit of SCUMM: painted rooms, point-and-click verbs, Ink for story. Orthogonal and isometric rooms, desktop and mobile, and an optional multiplayer layer on Cloudflare PartyServer.

One npm package, `sigilkit`, with subpath exports. Import only what you use; Pixi, React, Ink and PartyServer are optional peer dependencies.

```ts
import { World, defineGame } from "sigilkit";      // headless core, no DOM
import { InkRunner } from "sigilkit/story";         // + inkjs
import { ink } from "sigilkit/story/vite";          // Vite plugin for .ink imports
import { createRenderer } from "sigilkit/pixi";     // + pixi.js
import { GameShell, Stage } from "sigilkit/react";  // + react; "sigilkit/react/styles.css" for defaults
import { AudioDirector } from "sigilkit/audio";
import { startGamepad } from "sigilkit/input";      // controller + keyboard couch play
import { connect } from "sigilkit/net/client";      // + partysocket
import { RoomServer } from "sigilkit/net/server";   // + partyserver, in a Cloudflare Worker
```

## Quick start

```sh
npm install
npm run dev          # demo at http://localhost:5173
npm test
npm run typecheck
```

In the demo, take the watering can from the bench, water the planter, and talk to Moth. Then head up to the isometric rooftop. Debug overlay starts on; press **D** to toggle it, **S** / **L** to save and load, **Space** to advance dialog.

Multiplayer, in a second terminal:

```sh
npm run dev:party    # wrangler dev on :8787
# open http://localhost:5173/?party=localhost:8787 in two windows
```

## Making a game

Content is data plus Ink. A room:

```ts
import { defineRoom, tileArea, type RoomDef } from "sigilkit";

const base = {
  id: "greenhouse",
  projection: "orthogonal",          // or "isometric"
  tile: { width: 16, height: 16 },
  background: "greenhouse-bg",       // optional; omit for a blockout floor
  walkmap: [
    "####################",
    "#..................#",
    "#..###.......###...#",
  ],
  entries: { start: { at: { x: 4, y: 1 } } },
  actors: { moth: { at: { x: 11, y: 1 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...base,
  hotspots: [{
    id: "planter",
    name: "dry planter",
    shape: tileArea({ ...base, hotspots: [] }, 3, 2, 3, 1, 6),  // or { rect: [...] } / { polygon: [...] }
    standAt: { x: 4, y: 1 },
    verbs: { look: "planter_look", use: "planter_use" },         // Ink knots, or (ctx) => {...}
  }],
});
```

Story, in `story/main.ink`:

```ink
VAR planter_watered = false

=== planter_look ===
{ planter_watered:
    Wren: Something green is curling up out of it.
- else:
    Wren: The soil's cracked like an old circuit board.
}
-> END

=== planter_water ===
>>> sfx pour
~ planter_watered = true
Wren: There you go.
-> END
```

Wiring:

```tsx
const world = new World(game);
new InkRunner(world, story);   // import story from "./story/main.ink"
world.start();

<GameProvider world={world}>
  <GameShell stage={<Stage actors={(sprite) => placeholderActor(0xf3d27a)} />} />
</GameProvider>
```

Lines like `Name: text` are spoken by that actor, `>>> command` runs an engine command, and Ink `VAR`s mirror world flags. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full model.

## Layout

```
packages/
  sigilkit/src/
    core/       headless world (no DOM): runs in browser, tests, Workers   -> "sigilkit"
    story/      Ink runner + Vite plugin for .ink imports                  -> "sigilkit/story", "sigilkit/story/vite"
    pixi/       PixiJS v8 renderer                                         -> "sigilkit/pixi"
    react/      Stage, hooks, default UI, styles.css                       -> "sigilkit/react"
    audio/      Web Audio music/sfx                                        -> "sigilkit/audio"
    input/      gamepad + keyboard: stick walking, focus, dialog nav       -> "sigilkit/input"
    net/        PartyServer room, client, Better Auth verifiers            -> "sigilkit/net", "/server", "/client"
  phaser-shim/  satisfies grid-engine's phaser import (see ARCHITECTURE: known issue)
apps/
  demo/         two-room demo (orthogonal + isometric)
  party/        Cloudflare Worker hosting the demo's rooms
scripts/rename.ts
```

## Publishing

`npm run release:patch` (or `minor` / `major`) tags and pushes; `.github/workflows/release.yml` publishes `sigilkit` with provenance using npm trusted publishing. Set up a trusted publisher for `sigilkit` on npmjs.com (repo + `release.yml`) before the first release; no token secret is needed.

Games installing the published packages need the Phaser shim override described in [ARCHITECTURE.md](docs/ARCHITECTURE.md#known-issue-grid-engine-imports-phaser) until grid-engine's import is made lazy upstream.

## License

[Unlicense](UNLICENSE). The demo uses no third-party art or audio.
