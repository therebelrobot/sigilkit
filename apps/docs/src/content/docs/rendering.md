# Rendering (Pixi)

`sigilkit/pixi` draws a `World` with [PixiJS v8](https://pixijs.com/): room backgrounds or a blockout, depth-sorted actors and props, cutaways and fog, hotspot picking, the camera, and pixel-crisp scaling. Most games use it through `<Stage>` from `sigilkit/react`, which passes its props straight through. You can also create a renderer yourself.

```ts
import { createRenderer, placeholderActor } from "sigilkit/pixi";

const renderer = await createRenderer(world, {
  host: document.getElementById("game")!,
  actors: () => placeholderActor(0xf3d27a),
});
```

Needs the `pixi.js` peer.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `host` | required | Element to fill. Resizes are watched |
| `actors` | required | `ActorFactory`: sprite key → display |
| `props` | none | `PropFactory` for animated props |
| `resolveAsset` | none | Asset key → URL, for backgrounds and static props |
| `scaling` | `"auto"` | `"integer"` (crisp, may letterbox), `"fit"` (fill, fractional), or `"auto"` (integer at 2× and above, else fit) |
| `background` | | Letterbox colour |
| `blockout` | default palette | `Partial<BlockoutStyle>`, or `false` to draw nothing for rooms without art |
| `areas` | | `Partial<AreaLook>`: cutaway, shade and fog look |
| `debug` | `false` | Draw walkmap tiles and hotspot outlines |
| `showFocus`, `focusColor` | `true`, yellow | Outline the keyboard/gamepad focus target |
| `overheadSpeech` | `false` | Draw spoken lines above the speaker, SCUMM-style |
| `fontFamily` | `"monospace"` | Font for overhead speech |
| `onAltPress` | look | Long-press or right-click handler. `<Stage>` opens the verb coin |
| `longPressMs` | 450 | Long-press threshold |
| `pixi` | | Extra Pixi `ApplicationOptions` |

## The Renderer

```ts
interface Renderer {
  app: Application;                     // the Pixi app
  world: World;
  toRoom(clientX, clientY): Vec2 | null;  // DOM -> room pixels
  toClient(room: Vec2): Vec2;             // room pixels -> DOM, for overlays
  setDebug(on: boolean): void;
  layers: { floor: Container; world: Container; overlay: Container };
  destroy(): void;
}
```

The renderer drives the world: every frame it calls `world.update(deltaMs)`, then draws `world.actorViews()`. Pointer input becomes `world.hover(point)` and `world.activate(point)`.

## Scaling

The game renders at `game.resolution` (say 320 × 180) inside a letterboxed frame. `"auto"` keeps pixels crisp with whole-number scaling wherever that reaches 2×, and falls back to fractional scaling on small phones where integer scaling would leave the game tiny. Textures use nearest-neighbour sampling and positions are rounded, so pixel art stays sharp.

## The camera

Rooms larger than the frame scroll. The camera follows the player and clamps to the room's bounds (`room.size`, the background's size, or the grid's extent). Smaller rooms are centred.

## Actors

An `ActorFactory` is `(spriteKey, actorId) => ActorDisplay`:

```ts
interface ActorDisplay {
  view: Container;
  update(view: ActorView, deltaMs: number): void;
  destroy(): void;
}
```

The renderer positions `view` at the actor's foot point and sorts it. `update` gets the `ActorView` every frame, so it can pick animations from `moving` and `screenFacing`.

**Built in:**

- `placeholderActor(color, size = 14)`: a capsule with a facing dot and a walk bob.
- `sheetActor(spec)`: a classic grid spritesheet.

```ts
const texture = await Assets.load("/sprites/wren.png");
const actors: ActorFactory = (sprite) =>
  sheetActor({
    texture,
    frameWidth: 16,
    frameHeight: 32,
    rows: { down: 0, left: 1, right: 2, up: 3 }, // diagonals fall back to their horizontal half
    walkFrames: [1, 2, 3, 4],
    idleFrame: 0,
    fps: 8,
  });
```

## Props

`RoomDef.props` places scenery that depth-sorts with actors:

```ts
props: [
  { asset: "greenhouse-pillar", tile: { x: 6, y: 4 } },            // static art standing on a tile
  { asset: "greenhouse-glass", at: { x: 0, y: 0 }, depthTile: { x: 0, y: 9 } }, // pixel-placed art
  { id: "lamp", tile: { x: 3, y: 3 } },                            // drawn by a prop factory
],
```

| Field | Meaning |
| --- | --- |
| `id` | Lets a prop factory (or an area's `cover`) recognise it |
| `asset` | Static image key, resolved through `resolveAsset` |
| `tile` / `at` | Stand on a tile's foot point, or place the top-left at a pixel |
| `depthTile` | Tile used for depth sorting. Default `tile`, or the art's bottom edge |
| `anchor` | Point of the art on the placement point, as fractions. Default bottom-centre for `tile`, top-left for `at` |
| `level` | Level a `tile`-placed prop stands on |

A `PropFactory` is `(prop, { world, projection }) => PropDisplay | null`. Return a display (`view`, optional `update(deltaMs, world)`, `destroy`) to animate a prop, or `null` to fall back to its `asset`. The renderer positions and sorts the view and calls `update` every frame. That's how scenery reacts to game state.

## Effect layers

| Layer | Coordinates | Draws |
| --- | --- | --- |
| `layers.floor` | room pixels, follows camera | On the ground under walls, props and actors: paths, decals, ripples, runtime floor tiles |
| `layers.world` | room pixels, follows camera | Above actors and props: particles, auras |
| `layers.overlay` | logical screen pixels | Over the whole frame: tints, flashes, vignettes |

Add Pixi display objects to them. Use `renderer.app.ticker` for per-frame updates, and clean up on `roomChanged` if your effect belongs to one room.

## The blockout

Rooms without a resolvable `background` draw from the walkmap: a chequered floor, darker blocks for furniture letters, and `#` walls, raised in isometric rooms. Raised levels draw as slabs or solid blocks with stair risers, low openings get lintels, and shut doors draw as door-coloured blocks.

```ts
blockout: {
  floor: [0x3b5b4a, 0x416551], // chequer
  blocked: 0x1d2a2a,
  wallTop: 0x35504a, wallLeft: 0x2a3d3a, wallRight: 0x223230,
  door: 0x6b4e3d,
  wallHeight: 32,    // default: one tile height (RoomDef.wallHeight overrides per room)
  slabThickness: 4,
}
```

`blockout: false` draws nothing, for games that build rooms from runtime tiles in `layers.floor` and wall props.

## Cutaways, shade and fog

Every wall, slab, riser and prop is a "room piece" tagged with its level and tiles. Pieces the world reports as cut away fade to `areas.cutawayAlpha`. The outside of an interior is shaded, and unrevealed areas sit under fog. See [Levels, stairs and areas](/docs/levels-and-areas#tuning-the-look).

## Using another renderer

Nothing in the core depends on Pixi. A renderer needs to call `world.update(ms)` each frame, draw `world.actorViews()` (already projected and sorted by `sortY`), and turn clicks into `world.activate(roomPoint)`. The [Visual design](/docs/visual-design) guide covers drawing art that lines up with the grid.
