# AGENTS.md

Guidance for coding agents (and people) working in the sigilkit repository.

## What this is

sigilkit is a composable 2D adventure engine for React, in the spirit of LucasArts' SCUMM. It is published to npm as one unscoped package, `sigilkit`, with subpath exports. Games are content (room data, Ink, art, audio); the engine stays out of the way.

The main consumer right now is a private game, Nascent Genesis (an isometric, LOOM-inspired musical-spell adventure). Engine gaps that game finds are fixed here rather than worked around there.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing anything structural.

## Layout

```
packages/sigilkit/          the published package
  src/core/                 headless World: rooms, actors, movement, hotspots, verbs, commands, save/load
  src/story/                Ink runner + Vite plugin
  src/pixi/                 PixiJS v8 renderer, actor and prop displays
  src/react/                <Stage>, hooks, default UI, styles.css
  src/input/                gamepad + keyboard couch controls (Navigator, startGamepad, startKeyboard)
  src/audio/                AudioDirector: music crossfades, sfx, music ducking
  src/net/                  protocol, auth verifiers, PartyServer room, partysocket client
  test/                     Vitest suites (world, ink, input, protocol, audio)
  tsdown.config.ts          one entry per subpath export
packages/phaser-shim/       private stand-in for `phaser` (see "grid-engine and Phaser" below)
apps/demo/                  two-room demo (orthogonal greenhouse, isometric rooftop)
apps/party/                 Cloudflare Worker hosting the demo for multiplayer
docs/                       ARCHITECTURE, VISUAL_DESIGN, AUDIO_DESIGN, LEVEL_DESIGN
scripts/release.ts          bump, commit, tag, push
```

## Commands

```sh
npm install
npm run dev          # demo on http://localhost:5173 (D toggles debug overlay)
npm run dev:party    # multiplayer worker via wrangler on :8787
npm test             # vitest run
npm run typecheck    # tsc --noEmit across the workspace
npm run build        # tsdown into packages/sigilkit/dist
npm run release:patch | release:minor | release:major
```

CI runs `typecheck`, `test`, `build` and a `wrangler deploy --dry-run` of `apps/party`. Run the first three before calling a change done.

## Conventions

- **TypeScript 7**, `moduleResolution: bundler`, **no `.js` extensions** on relative imports.
- **npm workspaces**, not pnpm or yarn. Node version comes from `.nvmrc` (latest).
- **License: Unlicense.** New files need no header.
- **Names are descriptive and self-documenting.** Prefer `segmentStartOnScreen` over `a`, `resonatorDefinition` over `r`. Short names are fine only for conventional loop indices and the math in `projection.ts`.
- **Dependency direction is one way.** Every module may import `core`; `core` imports only grid-engine and has **no DOM**, because the same `World` runs in the browser, in tests and in a Durable Object. If something needs `window`, `document` or Pixi, it doesn't belong in `core`.
- **Peers stay optional.** `pixi.js`, `react`, `inkjs`, `partyserver`, `partysocket` and `vite` are optional peer dependencies. A module may only import its own peer.
- **Composable over batteries-included.** Prefer a small hook, factory or event a game can plug into (`PropFactory`, `onButton`, `renderer.layers`) over a built-in feature with options.
- **Content is data.** `defineGame`, `defineRoom` and Ink are the authoring surface. Keep new authoring features expressible in those (a field on `RoomDef`, an Ink command) before reaching for code.
- **World time, not wall time,** in `core` (`world.wait`, `world.time`), so tests and servers stay deterministic.
- **Development reads source.** The package exports TypeScript under the `sigilkit-source` condition; Vite, Vitest and tsc resolve it directly. `dist/` exists only for publishing.

## Adding or changing a subpath export

All four must agree, or publishing breaks:

1. `packages/sigilkit/package.json` `exports` (with the `sigilkit-source`, `types` and `default` conditions)
2. `packages/sigilkit/tsdown.config.ts` `entry`
3. The table in `packages/sigilkit/README.md` (the npm readme) and in `docs/ARCHITECTURE.md`
4. `peerDependenciesMeta` if it brings a new optional peer

## Tests

- Core behaviour gets a Vitest test in `packages/sigilkit/test/`. Build a tiny `defineGame` inline (see `world.test.ts`), use `new World(game, { autoAdvanceMs: 1 })` so dialog resolves itself, and drive time with `world.update(ms)`.
- Input logic is tested on `PadSnapshot` objects, never the real Gamepad API. Audio routing is tested against a small fake `AudioContext` (see `audio.test.ts`).
- Rendering isn't unit-tested; check it in `npm run dev` with the debug overlay on, in both the orthogonal and isometric rooms.
- A bug fix gets a regression test that fails on the old code where practical (the isometric step-interpolation fix is the model).

## Releasing

`npm run release:<level>` refuses to run with a dirty tree, bumps the package, commits `chore: release vX.Y.Z`, tags and pushes. The `v*` tag triggers `release.yml`, which publishes with npm provenance through trusted publishing (no stored token). Workspace apps depend on `sigilkit` as `"*"` so a bump never strands them.

When handing changes to the maintainer as a patch file, it is a plain `git diff`: apply with `git apply`, not `git am`.

## grid-engine and Phaser

grid-engine imports `phaser` at module load only to read an enum. `packages/phaser-shim` is a private workspace named `phaser` that exports just that enum, so neither the demo nor the Worker bundles Phaser. Games need the same shim (`"phaser": "file:./vendor/phaser-shim"`). Don't remove it until grid-engine makes that import lazy upstream.

## Hard rules

- **No private hostnames, personal domains or internal machine names** in code, configs, docs or READMEs. Use placeholders such as `example.com` or `<docker-host>`.
- **No `Co-authored-by` trailers** or co-author notes in commits or patches made on the maintainer's behalf.
- **Never push or publish** unless explicitly asked. Releases go through `scripts/release.ts`.
- Don't add model-provider integrations (AI APIs) to the engine.

## Where things are documented

| Topic | Doc |
| --- | --- |
| Modules, world model, interaction, multiplayer, roadmap | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Art: projections, painting rooms, tilesets, props, sprites, effect layers | [docs/VISUAL_DESIGN.md](docs/VISUAL_DESIGN.md) |
| Audio: music, sfx, dialog sound, ducking, file formats | [docs/AUDIO_DESIGN.md](docs/AUDIO_DESIGN.md) |
| Designing and building a new room or level | [docs/LEVEL_DESIGN.md](docs/LEVEL_DESIGN.md) |
