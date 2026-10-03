# Architecture

The goal: an engine that gets out of the way of story, dialog, art and music. Content is data and Ink; the engine is a handful of small packages you compose, each replaceable.

## Package layout

One package, `sigilkit`, split into modules exposed as subpath exports:

```
sigilkit              core: headless world (rooms, actors, movement, hotspots, verbs, inventory, flags, commands, save/load)
sigilkit/story        Ink binding                               (peer: inkjs)
sigilkit/story/vite   Vite plugin that compiles .ink imports    (peer: vite)
sigilkit/pixi         PixiJS v8 renderer: backgrounds, depth-sorted actors, picking, scaling, camera   (peer: pixi.js)
sigilkit/react        <Stage>, hooks, unstyled default UI (dialog, choices, verbs, inventory, verb coin)   (peer: react)
sigilkit/audio        Web Audio: crossfading music, sfx, ducking under dialog
sigilkit/input        gamepad + keyboard "couch" controls: stick walking, focus, dialog navigation
sigilkit/net          protocol types + auth verifiers
sigilkit/net/server   PartyServer room + Worker handler          (peer: partyserver)
sigilkit/net/client   partysocket client                         (peer: partysocket)
```

Every peer is optional: a game that never imports `sigilkit/net/server` never needs partyserver installed. One name to publish and version, with no scope needed.

Dependency direction is one-way: every module imports `core`; `core` depends only on grid-engine. `core` has no DOM, so the same `World` runs in the browser, in tests, and inside a Durable Object.

| Need | Default | Swap it for |
| --- | --- | --- |
| Rendering | `sigilkit/pixi` | any renderer that reads `world.actorViews()` and calls `world.activate()` |
| Actor art | `placeholderActor`, `sheetActor` | any `ActorFactory` (Aseprite JSON, Spine, single PNGs) |
| Story | `InkRunner` | any `ScriptRunner` (`run(path, ctx)`), or plain TS handlers |
| UI | `GameShell` + components | your own components on the same hooks |
| Audio | `AudioDirector` | anything listening to `world.events` `music` / `sfx` |
| Auth | `betterAuthVerifier` | any `(request) => Identity \| null` |

## The world model

A **game** is `defineGame({...})`: actors, rooms, items, verbs, flags. A **room** is:

- `projection`: `"orthogonal"` or `"isometric"`
- `tile`: tile footprint in pixels (iso is usually 2:1, e.g. 32x16)
- `walkmap`: ASCII rows, `.` walkable, anything else blocked
- `background` (optional): a painted image. Without one, the renderer draws a blockout from the walkmap so rooms are playable before art exists
- `hotspots`: shapes in room pixels, each with verbs → handlers
- `actors`, `entries` (named spawn points), `music`, `onEnter`

### Hybrid movement

SCUMM rooms are painted pictures with invisible walkable areas; grid-engine is tile movement. The engine keeps both:

- **Art is free-form.** Backgrounds and hotspots live in pixel space, so the art is never constrained to a tile grid.
- **Feet are on a grid.** The walkmap is a fine grid (16px tiles at 320x180 is plenty) that grid-engine pathfinds over, with collisions between actors.
- **Input is point-and-click.** Tap the floor to walk there (closest reachable tile if blocked). Tap a hotspot to walk to its `standAt` tile, face it, and run the verb.

Rendering is smooth: `actorViews()` interpolates between tiles using grid-engine's movement progress, then projects to pixels.

The grid buys server-side pathfinding for multiplayer (cheap, deterministic, cheat-resistant) and makes isometric a projection change instead of a second engine.

### Projections

Everything spatial goes through `Projection`:

```ts
tileToScreen(x, y)   // fractional tile -> foot point in room pixels
screenToTile(px, py) // pointer picking
depth(x, y)          // draw order
bounds(cols, rows)   // camera clamping
```

`orthogonal` and `isometric` (diamond) ship. `tileArea(room, x, y, w, h, lift)` builds a hotspot polygon from tiles, raised by `lift` pixels to cover art standing on them, so hotspots stay correct in either projection. Actors, props and raised iso blocks all z-sort by foot y, which matches both projections.

Facing has two forms on `ActorView`. `facing` is in grid space: what `face` and scripts use, and what a step along the grid reports. `screenFacing` is the same direction as it appears on screen; in an isometric room, walking grid-right travels down-right on screen. Sprite factories pick animation rows from `screenFacing`. Movement is interpolated along the exact step grid-engine is taking, rather than inferred from its facing, which grid-engine reports in screen terms for isometric maps.

Room-to-room transitions can switch projection: the demo walks from an orthogonal greenhouse to an isometric rooftop.

### Interaction

```
tap/click ──► world.activate(point)
                 │ pick(): hotspot (highest z) ► actor ► floor tile
                 ▼
          floor: walk(player, tile)
          target: verb = selected verb, or target.default, or game.defaultVerb
                 ▼
          interact(): busy=true ► walk to standAt ► face ► handler ► busy=false
```

- **Verb selection** is three ways at once, so it works on any device: tap uses the target's default verb; the verb bar sets a verb for the next tap; long-press (touch) or right-click opens the verb coin at that point.
- **Items:** select one in the inventory, tap a target, and `items[id].with[target]` runs. The sentence line reads "Use watering can with dry planter".
- **No handler** makes the player say `game.fallback(verb, target)`.

### Gamepad and keyboard (`sigilkit/input`)

Pointer play targets things directly; couch play needs a cursor-free model. `Navigator` provides it, and `startGamepad` / `startKeyboard` drive it:

- **Walking** steps one tile at a time toward a screen-space direction (`world.stepToward`), so "stick up" means up on screen in any projection. Isometric rooms should set `directions: 8` so screen-up is a single diagonal step.
- **Focus** follows the nearest hotspot or verb-bearing actor within range while you walk. LB/RB (Tab on keyboard) cycle by hand, and the renderer outlines the focused target. Focus switches off while the last-used device is a pointer.
- **Acting:** A/Enter uses the focused target's default verb, X/L looks, B/Esc clears focus or drops a held item.
- **Dialog:** A advances lines; the stick or d-pad moves the choice cursor (`ui.choiceIndex`).
- **Game modes** hook in without forking the driver. `onButton` can consume any press (the spell distaff in Nascent Genesis holds LT and turns the d-pad and face buttons into notes), and `onFrame` can suppress movement while a mode owns the pad.
- **Prompts:** `inputMode` records which device was used last (gamepad, keyboard or pointer) so the UI can show matching button glyphs.

Gamepad logic runs on plain `PadSnapshot` objects, so it's unit-tested without the Gamepad API.

### Commands

Commands are the verbs of scripting, usable from Ink (`>>> walk wren 4 6`), from TS (`world.command("walk wren 4 6")`) or as methods (`world.walk(...)`). Built-ins: `walk face say wait goto give take set show hide place music sfx`. Add your own with `world.commands.set(name, fn)`; async commands are awaited, so cutscenes are just sequential lines.

`wait` uses world time, not wall time, so tests and servers are deterministic.

### UI state

`world.ui` is a tiny store compatible with `useSyncExternalStore`: current line, choices, verb, held item, hover label, busy, inventory, room. React hooks (`useDialog`, `useVerbs`, `useInventory`, `useUi`) read it; components are optional.

### Save/load

`world.serialize()` returns plain JSON: room, every actor's room/tile/facing/visibility, inventory, flags, and the Ink state blob. `world.load(state)` restores it. It's small enough for localStorage, a file, or a server.

## Story: Ink

`InkRunner` makes Ink knots into handlers. A hotspot verb `"planter_look"` runs `=== planter_look ===`.

| In Ink | Becomes |
| --- | --- |
| `Moth: hello` | a line spoken by the actor whose id or name is "Moth" |
| `>>> goto rooftop hatch` | an engine command, awaited |
| a line without a known speaker | narration |
| `* [choice]` | choices in the UI |
| `VAR door_open = false` | mirrored with world flag `door_open`, both directions |
| `has_item("can")`, `flag("x")`, `target()`, `verb()`, `held_item()` | externals that read the world |
| `# tags` | passed through on the line (mood, portrait, voice cue) |

Write in Inky, or any editor; `import story from "./main.ink"` compiles at build time with errors in the dev overlay. `INCLUDE` works and is watched.

## Rendering and scaling

The game renders at a fixed logical resolution (`game.resolution`, e.g. 320x180) inside a letterboxed frame:

- `scaling: "auto"` (default) uses crisp integer scaling at 2x and above, and fractional scaling on small phones where integer scaling would leave the game tiny
- the host is watched with a `ResizeObserver`, so rotation and UI reflow just work
- rooms larger than the frame scroll; the camera follows the player and clamps to room bounds
- nearest-neighbour sampling and `roundPixels` keep pixel art sharp

Default UI docks below the stage. Dialog and choices float over the bottom edge of the stage so the stage never reflows mid-conversation; on short landscape phones the whole panel overlays.

Dialog defaults to the DOM box: it scales with system font settings and reaches screen readers. `overheadSpeech: true` gives SCUMM-style text above the speaker.

### Props, layers and the blockout

- **Animated props:** `RoomDef.props` entries can be placed by `tile` (fractional tiles centre a prop across several) and given an `id`. A renderer `props` factory returns a `PropDisplay` for any of them; it's updated every frame with the world, and depth-sorts with actors. Props the factory skips fall back to their static `asset`, anchored bottom-centre on a tile (top-left at an `at` point) unless `anchor` says otherwise. This is how scenery reacts to game state without becoming fake actors.
- **Effect layers:** `renderer.layers.floor` sits on the ground under walls, props and actors (paths, ripples, decals); `renderer.layers.world` is above them (particles, auras). Both are in room pixels and follow the camera. `renderer.layers.overlay` covers the frame in logical pixels (tints, flashes, static).
- **Blockout:** rooms without art draw from the walkmap. `'#'` is wall, raised in isometric rooms; other non-`'.'` characters are blocked floor under furniture. `blockout: { floor, blocked, wallTop, wallLeft, wallRight, wallHeight }` sets the palette; `blockout: false` turns it off for games that draw rooms from runtime tiles.

## Multiplayer (optional)

```
browser ──ws──► Worker fetch ──► createPartyHandler(verify)
                                  │ verify(request) -> Identity | 401
                                  │ stamps x-sigilkit-identity (client copies are stripped)
                                  ▼
                        Durable Object per game room ("greenhouse", or "eu1~greenhouse" for shards)
                        RoomServer: World(room, spawnPlayer:false), 20Hz tick
```

**v0 model: shared presence, local narrative.**

- The server owns where every player is. Clients send walk intents; the server re-runs pathfinding (walls and teleports are impossible) and broadcasts target tiles.
- Each client animates other players locally from those targets, and predicts its own movement. The server corrects it only if a walk genuinely failed.
- Story, dialog and NPCs run per client. Two players can be mid-conversation with the same NPC without interfering.
- Changing rooms reconnects to that room's Durable Object.
- Protocol: `walk`, `chat` up; `welcome`, `joined`, `left`, `moves`, `correct`, `chat`, `error` down. Messages are validated and rate-limited per connection; a second tab with the same identity replaces the first.

**Auth: Better Auth.** `betterAuthVerifier(auth)` when Better Auth runs in the same Worker, or `betterAuthRemoteVerifier(url)` for a separate auth service. Browsers can't set headers on WebSockets, so a `?token=` from Better Auth's bearer plugin is promoted to an `Authorization` header. Same-origin cookie sessions work without it. `guestVerifier` is for local development only.

**Next layers, when a game needs them:**

1. Server-owned shared flags: a `RoomServer` subclass handles a `flag` message, validates it, and broadcasts. This covers a door one player opens being open for everyone.
2. Server-run handlers: run selected hotspot handlers on the server (the `World` is already there) for puzzles that must be shared or anti-cheat.
3. Persistence: the Durable Object's SQLite (`this.sql`) for per-room state, and Better Auth's user id as the key for saves.

## Known issue: grid-engine imports Phaser

grid-engine's ESM bundle does `import { Tilemaps } from "phaser"` at module load, only to read `Tilemaps.Orientation.ISOMETRIC` inside its Phaser adapter. Headless use never calls that code, but the import alone pulls in all of Phaser, which also crashes in Workers because it touches `window`.

- **In this repo:** `packages/phaser-shim` is a private workspace named `phaser` that exports just that enum. npm links it as `node_modules/phaser`, satisfying grid-engine's peer dependency.
- **For published packages:** consumers need the same shim. Either publish it (e.g. `sigilkit-phaser-shim`) and have games add `"overrides": { "phaser": "npm:sigilkit-phaser-shim@4.0.0" }`, or fix it upstream.
- **Recommended:** send grid-engine a PR that makes the Phaser import lazy, or compares against the string `"isometric"`. That removes the shim entirely.

## Toolchain

- TypeScript 7 with `moduleResolution: bundler` and no `.js` import extensions; npm workspaces; Node latest (`.nvmrc`)
- The package exports its TypeScript source under a custom `sigilkit-source` condition. Vite, Vitest, tsc and wrangler (via aliases) all read source directly, so there is no build step while developing. `dist/` is only for publishing.
- tsdown builds every subpath (ESM + d.ts) into `dist/<module>/`
- Vitest for core, story and net; wrangler dry-run in CI to catch Worker bundling breaks
- Release: `npm run release:patch|minor|major` pushes a `v*` tag; `release.yml` publishes `sigilkit` with npm provenance via trusted publishing (OIDC, no stored token)

## Roadmap

Roughly in the order a first real game would hit them:

1. **Art pipeline:** Aseprite JSON → `ActorFactory` with named tags (`walk-down`, `talk-left`); talk animations driven by `ui.line.speaker`
2. **Room editor overlay:** in the debug view, paint walkmap tiles and drag hotspot polygons, then copy the room definition as TS. This is where most authoring time goes.
3. **Walk-behind masks:** a per-room mask image plus depth line, for painted foreground that occludes actors (SCUMM's z-planes)
4. **Cutscene helpers:** camera pans, fades, `skippable` blocks (tap to fast-forward world time)
5. **Scaling actors with depth:** SCUMM-style perspective scale by screen y for orthogonal rooms with painted perspective
6. **Tiled import:** load `.tmj` walk layers and object layers as walkmap and hotspots
7. **Localization:** Ink's line tags as string ids; swap compiled stories per locale
8. **Shared-state multiplayer:** layers 1 to 3 above
9. **Accessibility pass:** keyboard hotspot cycling, hotspot highlight toggle, text speed and size, reduced motion
