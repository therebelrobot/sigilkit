# Rooms and walkmaps

A room is a `RoomDef`: plain data describing where feet can go, what can be clicked, who's there and how it's drawn. Rooms are made with `defineRoom` and listed in the game's `rooms`.

```ts
import { defineRoom } from "sigilkit";

export const greenhouse = defineRoom({
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "####################",
    "#..................#",
    "#..###.......###...#",
    "#..................#",
    "####################",
  ],
  entries: { start: { at: { x: 4, y: 3 }, facing: "right" } },
  hotspots: [],
});
```

## Hybrid movement

SCUMM-era rooms are painted pictures with invisible walkable regions. Grid-based engines move characters tile by tile. sigilkit uses both:

- **Art is free-form.** Backgrounds, props and hotspots are in pixel space, so the art is never constrained to a grid.
- **Feet are on a grid.** The walkmap is a fine grid (16 px tiles at 320 × 180 is plenty) that characters pathfind across, avoiding each other.
- **Input is point-and-click.** Tap the floor to walk there (to the closest reachable tile if that one's blocked). Tap a hotspot to walk to its `standAt`, face it, and run the verb.

Movement is drawn smoothly between tiles, so the grid isn't visible in play. It's what makes pathfinding cheap and deterministic enough to run on a server, and what makes an isometric room a change of projection rather than a second engine.

## The walkmap

One string per row, one character per tile:

| Character | Meaning |
| --- | --- |
| `.` | Walkable floor |
| `#` | Wall. The blockout raises it in isometric rooms |
| anything else | Blocked floor: furniture, water, a pit. Pick letters that help you read the map |

Every row should be the same length. The walkmap is only about walking. With painted art, it's invisible.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Must match its key in `game.rooms` |
| `projection` | `"orthogonal" \| "isometric"` | How tiles map to pixels |
| `tile` | `{ width, height }` | One tile in pixels. Isometric tiles are usually 2:1, e.g. 32 × 16 |
| `walkmap` | `string[]` | The base level's walkability |
| `hotspots` | `HotspotDef[]` | Clickable things. See [Hotspots and verbs](/docs/hotspots-and-verbs) |
| `entries` | `Record<string, ActorPlacement>?` | Named arrival points for `goto` |
| `actors` | `Record<string, ActorPlacement>?` | Actors who start in this room |
| `background` | `string?` | Asset key of the painted room image. Without one, the renderer draws a blockout |
| `props` | `PropDef[]?` | Scenery that depth-sorts with actors. See [Rendering](/docs/rendering#props) |
| `size` | `{ width, height }?` | Room size in pixels. Default: the background's size, or the grid's bounds |
| `origin` | `{ x, y }?` | Pixel offset of tile (0,0) inside the room art |
| `directions` | `4 \| 8` | Movement directions. Use 8 in isometric rooms for keyboard and stick play. Default 4 |
| `music` | `string?` | Music key, emitted as a `music` event on entry |
| `onEnter` | `Handler?` | Runs every time the player arrives |
| `wallHeight` | `number?` | Blockout wall height for this room, overriding the renderer's |
| `levels`, `stairs`, `baseLevel` | | Stacked floors. See [Levels, stairs and areas](/docs/levels-and-areas) |
| `areamap`, `areas` | | Named regions, interiors, fog |
| `clearances` | `ClearanceDef[]?` | Low openings |
| `doors` | `DoorDef[]?` | Tiles walkable only while open. See [Doors](/docs/doors) |

## Entries

```ts
entries: {
  start: { at: { x: 4, y: 8 }, facing: "right" },
  door: { at: { x: 17, y: 4 }, facing: "down" },
},
```

An entry is an `ActorPlacement`: a tile, an optional facing, and an optional `level` in multi-level rooms. `goto("greenhouse", "door")` puts the player there. With no entry named, the first one is used. A room with no entries starts the player on its first walkable tile.

## Projections

Everything spatial goes through the room's `Projection`:

```ts
interface Projection {
  kind: "orthogonal" | "isometric";
  tileToScreen(x, y): Vec2;    // fractional tile -> foot point in room pixels
  screenToTile(px, py): TilePos; // a click -> the tile under it
  depth(x, y): number;         // draw order
  bounds(cols, rows): { x, y, width, height };
}
```

- **Orthogonal:** tile (x, y)'s centre is at `origin + ((x + 0.5) × width, (y + 0.5) × height)`.
- **Isometric (diamond):** tile (x, y)'s centre is at `origin + ((x − y) × width/2, (x + y + 1) × height/2)`. Without an `origin`, the room is shifted so the whole diamond is on the canvas.

`world.projection` is the current room's, and `projectionFor(room)` builds one for any room. [Visual design](/docs/visual-design#2-coordinates) explains how to draw art that lines up.

## Backgrounds and the blockout

With `background: "greenhouse-bg"`, the renderer resolves that key through `resolveAsset` and draws the image with its top-left corner at room pixel (0, 0). The room's size becomes the image's size, and `origin` says where tile (0, 0) sits inside it. Without a background (or while you're still painting it), the renderer draws a **blockout** from the walkmap: chequered floor, darker furniture blocks, and walls (raised in isometric rooms). Rooms are playable before any art exists. See [Rendering](/docs/rendering#the-blockout).

## Rooms bigger than the screen

If a room is larger than `game.resolution`, the camera follows the player and stops at the room's edges. If it's smaller, it's centred.

## Connecting rooms

A door is a hotspot whose handler calls `goto`:

```ts
{ id: "door", name: "roof door", shape: tileArea(base, 17, 3, 2, 1, 24), standAt: { x: 17, y: 4 },
  default: "walk", verbs: { walk: "door_walk" } }
```

```ink
=== door_walk ===
>>> goto rooftop hatch
-> END
```

Only the current room is simulated. Actors in other rooms keep their positions in `world.state` until the player arrives.

## The authoring pattern

`tileArea` needs the room's projection and tile size to build hotspot shapes, so it's common to split a room into the data without hotspots, then the hotspots built from it:

```ts
const greenhouseBase = { id: "greenhouse", projection: "orthogonal", tile: { width: 16, height: 16 }, walkmap: [/* … */] }
  satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [{ id: "planter", shape: tileArea({ ...greenhouseBase, hotspots: [] }, 3, 5, 3, 2, 6), /* … */ }],
});
```

[Designing a room](/docs/level-design) walks through building a room from paper sketch to tested blockout.
