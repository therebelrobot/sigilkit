# Introduction

sigilkit is a composable 2D adventure engine for React, in the spirit of LucasArts' SCUMM: painted rooms, point-and-click verbs, characters who walk where you click, and a story written in [Ink](https://www.inklestudios.com/ink/). It supports orthogonal and isometric rooms, plays on desktop, phones and gamepads, and has an optional multiplayer layer on Cloudflare PartyServer.

It's built on one idea: **games are content**. A room is a data object. A story is an Ink file. The engine is a handful of small pieces you compose, and you can replace any of them.

> [!TIP]
> Learn faster by playing: the [Learn](/learn) section has 18 short lessons, each with a running game beside the text that you can edit.

## What it looks like

A room says where feet can go and what's clickable:

```ts
export const greenhouse = defineRoom({
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: ["##########", "#........#", "#..pp....#", "#........#", "##########"],
  hotspots: [
    { id: "planter", name: "dry planter", shape: tileArea(base, 3, 2, 2, 1, 6), standAt: { x: 3, y: 3 },
      verbs: { look: "planter_look", use: "planter_use" } },
  ],
});
```

The story says what happens:

```ink
=== planter_look ===
Wren: The soil's cracked like an old circuit board.
>>> walk wren 6 3
-> END
```

And a few lines of wiring put it on screen:

```tsx
const world = new World(game);
new InkRunner(world, story);
world.start();

export const App = () => (
  <GameProvider world={world}>
    <GameShell stage={<Stage actors={() => placeholderActor(0xf3d27a)} />} />
  </GameProvider>
);
```

## How it fits together

sigilkit is one npm package, split into modules by subpath. Import only what you use. Everything beyond the core is an optional peer dependency.

| Import | What it is | Peer |
| --- | --- | --- |
| `sigilkit` | The headless **World**: rooms, actors, grid movement, hotspots, verbs, inventory, flags, commands, save/load. No DOM. | — |
| `sigilkit/story` | Ink runner: knots as handlers, `Name: line` speech, `>>> command` lines, VARs mirrored to flags | `inkjs` |
| `sigilkit/story/vite` | Vite plugin: `import story from "./main.ink"` | `vite` |
| `sigilkit/pixi` | PixiJS v8 renderer: backgrounds or blockout, depth-sorted actors and props, picking, scaling, camera | `pixi.js` |
| `sigilkit/react` | `<Stage>`, hooks, unstyled default UI, optional `styles.css` | `react` |
| `sigilkit/input` | Gamepad and keyboard play: stick walking, focus, dialog navigation | — |
| `sigilkit/audio` | Web Audio music crossfades, sfx, ducking under dialog | — |
| `sigilkit/net`, `/net/server`, `/net/client` | Multiplayer room on PartyServer, partysocket client, auth verifiers | `partyserver`, `partysocket` |

Dependencies point one way: every module imports the core, and the core imports nothing but its pathfinding library. Because the core has no DOM, the same `World` runs in the browser, in a Vitest test and inside a Cloudflare Durable Object.

## Design principles

- **Content is data.** `defineGame`, `defineRoom` and Ink are the authoring surface. New features show up as a field on `RoomDef` or an Ink command before they show up as code you have to write.
- **Art is free, feet are on a grid.** Backgrounds and hotspots live in pixel space, so art is never constrained to tiles. Walking happens on a fine grid underneath, which makes pathfinding cheap, deterministic and runnable on a server, and turns isometric into a change of projection rather than a second engine.
- **Composable over batteries-included.** Small hooks, factories and events (`ActorFactory`, `PropFactory`, `onButton`, `renderer.layers`) instead of features with option flags. Every default has a documented way to swap it out.
- **Playable before it's pretty.** Rooms without art draw a blockout from their walkmap, and actors start as coloured placeholders. You can build and test a game before anything is painted.
- **World time, not wall time.** Scripts wait in world time, so tests and servers are deterministic.

## Where to go next

- [Installation](/docs/installation): set up a project, including the one install quirk.
- [Quick start](/docs/quick-start): a playable room in about five minutes.
- [Learn](/learn): interactive lessons, from the first room to multiplayer.
- [API reference](/docs/api): every export, by module.
