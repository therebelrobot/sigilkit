# Visual design

How sigilkit puts pictures on screen, and how to make art that lines up with it: room backgrounds, tilesets, props, character sprites and effect layers. Read this before painting the first room, because a few numbers (resolution, tile size, origin) are expensive to change later.

Everything here is about `sigilkit/pixi`. A custom renderer only needs to honour the same coordinate rules.

## 1. Pick the frame first

A game renders at one fixed **logical resolution**, `game.resolution`, and the renderer scales that box to fit the screen:

- `scaling: "auto"` (default): whole-number scaling when the screen allows 2x or more, fractional "fit" scaling on small phones where whole numbers would leave the game tiny.
- `"integer"`: always crisp, may leave wide borders. `"fit"`: always fills, may shimmer on pixel art.
- Nearest-neighbour sampling and `roundPixels` are on globally, so pixel art stays sharp.

| Logical size | Whole-number fits | Feel |
| --- | --- | --- |
| 320×180 | 4× 720p, 6× 1080p, 12× 4K | chunky, classic SCUMM / LOOM |
| 480×270 | 4× 1080p, 8× 4K | more room for detail, still clearly pixel art |
| 640×360 | 2× 720p, 3× 1080p, 6× 4K | detailed; tiles get small on phones |

Paint every asset at **1× logical pixels**. Never paint at 4× and scale down: the renderer does the scaling.

Rooms may be larger than the frame; the camera follows the player and clamps to the room's bounds. A room smaller than the frame is centred.

## 2. Coordinates

There are three spaces:

- **Tile space:** integer `(x, y)` on the walkmap, fractional while walking. Scripts, `standAt`, `entries`, `place` and `walk` use it.
- **Room pixels:** the room's own picture, `(0, 0)` at the top-left of the background. Hotspot shapes, `PropDef.at`, `renderer.layers.floor` and `renderer.layers.world` use it.
- **Logical frame pixels:** the `game.resolution` box, fixed to the screen. Only `renderer.layers.overlay` uses it.

`world.projection` converts tile space to room pixels:

```ts
world.projection.tileToScreen(x, y)   // tile centre ("foot point") in room pixels
world.projection.screenToTile(px, py) // tile under a room pixel
world.projection.depth(x, y)          // sort key, larger is in front
world.projection.bounds(cols, rows)   // pixel bounds of the grid
```

### Orthogonal

```
tile (x, y) centre = origin + ((x + 0.5) · tileWidth, (y + 0.5) · tileHeight)
```

`origin` defaults to `(0, 0)`, the top-left corner of tile `(0, 0)`. 16×16 tiles at 320×180 give a 20×11 grid, which is plenty: the grid is only where feet go, not what the art looks like.

### Isometric (diamond)

```
tile (x, y) centre     = origin + ((x − y) · tileWidth/2,  (x + y + 1) · tileHeight/2)
tile (x, y) top corner = origin + ((x − y) · tileWidth/2,  (x + y)     · tileHeight/2)
```

- `origin` is the **top corner of tile (0, 0)**. It defaults to `(rows · tileWidth/2, 0)`, which puts the whole diamond on canvas with no headroom.
- Use **2:1 tiles** (32×16 is the house size). Grid x runs down-right on screen and grid y runs down-left.
- The grid's pixel footprint is `(cols + rows) · tileWidth/2` wide and `(cols + rows) · tileHeight/2` tall. Walls and tall props rise above that, so leave headroom: push `origin.y` down by at least your wall height, and set `room.size` to the full picture.
- Set `directions: 8` on isometric rooms, so "stick up" (a grid diagonal) is a single step.

A 9×9 isometric room with 32×16 tiles is 288×144 pixels of floor. With `origin: { x: 160, y: 30 }` and `size: { width: 320, height: 180 }` it fills a 320×180 frame with 30 px of wall headroom.

## 3. Draw order

Inside the camera, bottom to top:

1. **Room floor:** the painted `background`, or the blockout drawn from the walkmap.
2. **`renderer.layers.floor`:** ground effects (paths, ripples, decals, glowing threads). Under everything that stands up.
3. Debug overlay (walkmap tint, hotspot outlines) when on.
4. **Entities, depth-sorted:** props, raised blockout walls and actors. Each has a `zIndex` equal to its foot point's room-pixel y. Larger y draws in front.
5. Focus outline (gamepad and keyboard play).
6. **`renderer.layers.world`:** effects above everything in the room (particles, auras, motes).
7. Overhead speech, when `overheadSpeech` is on.

Then, outside the camera, **`renderer.layers.overlay`** in logical frame pixels: tints, vignettes, flashes, film grain.

The effect layers belong to your game. They are **not cleared on room change**, so listen to `world.events.on("roomChanged", …)` and rebuild or clear what you put there.

### Sorting rules that keep art honest

- **Actors** sort by their foot point: the bottom-centre of the sprite. In multi-level rooms they sort by where that foot point would be on the base floor, nudged by elevation (`ActorView.sortY`), so standing on a balcony doesn't put you in front of the yard below it.
- **Tile-placed props** sort by `depthTile` if given, else `tile`. Use the **front-most tile** of the footprint (largest `x + y` in isometric, largest `y` in orthogonal) for `depthTile`, so an actor standing in front of the object draws over it.
- **`at`-placed props** without `tile` or `depthTile` sort by the bottom edge of their art.
- **Raised blockout walls** sort by their tile's centre, the same key actors use.
- One sort key per object only works for small footprints. Keep a single prop to **2×2 tiles or less**. Cut longer things (a counter, a fence, a long wall) into one prop per tile, each with its own `tile`.
- Painted-in foreground that should cover actors (a pillar in front of the walkable floor) can't live in the background. Make it a prop.

## 4. Rooms: painted backgrounds

This is the SCUMM way and the default: one painted picture per room, with an invisible walk grid under it.

1. **Block out first.** Leave `background` unset. The renderer draws the walkmap as flat floor, with `#` tiles as raised walls in isometric rooms. Play the room until the layout works.
2. **Make a tracing template.** Turn the debug overlay on (`renderer.setDebug(true)`, or the demo's **D** key), set `scaling: "integer"`, take a screenshot, and scale it down by the scale factor with nearest-neighbour. That gives a 1× image with every walkable tile and hotspot outlined.
3. **Paint over it** at 1× in your art tool. Keep the template as a hidden layer. The image's top-left is room pixel `(0, 0)`.
4. **Export** the floor and everything that never covers an actor as the background. Anything an actor can walk behind is a prop (see section 6).
5. **Wire it up:** `background: "workshop-bg"` on the room, and a `resolveAsset` on `<Stage>`:

   ```ts
   <Stage resolveAsset={(key) => `/art/${key}.png`} … />
   ```

   With Vite, either put files in `public/art/`, or import them for hashed URLs:

   ```ts
   const artUrlByPath = import.meta.glob("./art/**/*.png", { eager: true, query: "?url", import: "default" });
   const resolveArt = (key: string) => artUrlByPath[`./art/${key}.png`] as string | undefined;
   ```

   A key that doesn't resolve, or fails to load, falls back silently (blockout for backgrounds, nothing for props), so a missing file never crashes the game.

6. **Set `size`** to the painting's dimensions when the picture is bigger than the grid. Without it, the background's own size is used.

The walkmap never changes when art arrives. If the art and the floor disagree, move the art or the walkmap, never the projection.

## 5. Rooms: tilesets

sigilkit has no tilemap renderer of its own; the walkmap only decides where feet go. There are two good ways to build rooms from tiles anyway.

### A. Tiles in your art tool, flattened (recommended)

Build the room from a tileset in Aseprite, LDtk, Tiled or similar, using the same tile size and projection as the room. Export:

- the flattened floor as the room `background`
- each tall piece (walls, furniture, columns) as a separate prop image
- the collision layer typed out as the `walkmap` (`.` floor, `#` wall, any other letter for furniture)

This keeps runtime simple and lets the artist paint over seams.

### B. Tiles placed at runtime

Use this when rooms are generated, or when tiles animate or change with game state. Flat floor tiles go into `renderer.layers.floor`; anything that stands up must be a prop so it depth-sorts with actors.

```ts
import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { World } from "sigilkit";
import type { Renderer } from "sigilkit/pixi";

/** Tileset cell (column, row) for each walkmap character's floor. */
const FLOOR_CELL_BY_WALKMAP_CHARACTER: Record<string, [column: number, row: number]> = {
  ".": [0, 0],
  "o": [1, 0], // floor under furniture
  "#": [2, 0], // floor under walls (mostly hidden)
};

export function attachTiledFloor(renderer: Renderer, world: World, tilesetTexture: Texture) {
  const floorTiles = new Container();
  renderer.layers.floor.addChild(floorTiles);

  const buildFloorForCurrentRoom = () => {
    floorTiles.removeChildren().forEach((child) => child.destroy());
    const { width: tileWidth, height: tileHeight } = world.room.tile;
    world.room.walkmap.forEach((walkmapRow, tileY) => {
      [...walkmapRow].forEach((walkmapCharacter, tileX) => {
        const [column, row] = FLOOR_CELL_BY_WALKMAP_CHARACTER[walkmapCharacter] ?? [0, 0];
        const tileSprite = new Sprite(
          new Texture({
            source: tilesetTexture.source,
            frame: new Rectangle(column * tileWidth, row * tileHeight, tileWidth, tileHeight),
          }),
        );
        tileSprite.anchor.set(0.5); // the cell's centre sits on the tile centre
        const tileCentre = world.projection.tileToScreen(tileX, tileY);
        tileSprite.position.set(tileCentre.x, tileCentre.y);
        floorTiles.addChild(tileSprite);
      });
    });
  };

  buildFloorForCurrentRoom();
  const stopListening = world.events.on("roomChanged", buildFloorForCurrentRoom);
  return { destroy: () => (stopListening(), floorTiles.destroy({ children: true })) };
}
```

Raised tiles (walls, blocks) are props, so they depth-sort with actors. Generate one per wall tile, with an `anchor` that puts the block's floor diamond on the tile centre:

```ts
import type { PropDef } from "sigilkit";

/**
 * One static prop per '#' tile. The block image is tileWidth × (tileHeight + wallHeight);
 * its floor diamond's centre is wallHeight + tileHeight/2 from the top, and that
 * point goes on the tile centre.
 */
export function wallPropsFor(walkmap: string[], wallAssetKey: string, tileHeight: number, wallHeight: number): PropDef[] {
  const blockAnchor = { x: 0.5, y: (wallHeight + tileHeight / 2) / (wallHeight + tileHeight) };
  return walkmap.flatMap((walkmapRow, tileY) =>
    [...walkmapRow].flatMap((walkmapCharacter, tileX) =>
      walkmapCharacter === "#"
        ? [{ id: `wall:${tileX},${tileY}`, asset: wallAssetKey, tile: { x: tileX, y: tileY }, anchor: blockAnchor }]
        : [],
    ),
  );
}

// in the room: props: [...wallPropsFor(walkmap, "wall-block", 16, 30), ...otherProps]
```

Then turn the blockout off, so its own floor and walls don't draw under yours:

```tsx
<Stage blockout={false} … />
```

With `blockout: false`, a room with no `background` draws nothing at all under your tiles; set an explicit `size` on such rooms so the camera knows their bounds.

### Tile art specs (isometric, 32×16)

- **Floor tile:** 32×16 canvas, a diamond touching all four edges. Use the classic 2:1 pixel stepping (two across, one down) on the edges, and let neighbouring diamonds share their edge pixels so no seams show.
- **Block tile** (wall, crate, plinth): 32 × (16 + height) canvas. The top face is a 32×16 diamond at the top; the left and right faces drop `height` pixels below it.
- **Light** comes from the upper left. The blockout uses this convention: top face lightest, left face mid, right face darkest. Keep it the same across every tileset and prop so rooms read as one place.
- **Thickness:** floor tiles with a visible slab edge are `16 + edge` tall; anchor them at `(0.5, 8 / (16 + edge))`.
- Keep a **1-pixel transparent margin** around every cell in a tileset sheet if you ever use fractional scaling, or neighbouring cells bleed in.

### Tile art specs (orthogonal, 16×16)

- Top-down or three-quarter view. In three-quarter view, a wall's front face is its own row of tiles below the top.
- Anything taller than one tile that actors walk behind is a prop, sorted by its base row.

## 6. Props

`RoomDef.props` are scenery that depth-sorts with actors. A prop is placed one of two ways:

| Field | Placement | Static art is anchored at |
| --- | --- | --- |
| `at: { x, y }` | room pixels | its top-left, unless `anchor` says otherwise |
| `tile: { x, y }` | that tile's centre; fractional tiles centre it across several (`{ x: 3.5, y: 1.5 }` sits between four tiles) | its **bottom-centre**, on the tile centre, unless `anchor` says otherwise |

Optional: `depthTile` (the tile to sort by; see section 3), `id` (so a factory can recognise it), and `anchor` (which point of static art sits on the placement point, as fractions of its size).

**Static art:** set `asset` to a key `resolveAsset` understands. For tile-placed art, draw the object so its **foot point is the bottom-centre pixel of the image**. For a free-standing object (a lamp, a plant, a person-sized statue), that is where it touches the floor. When the foot point is somewhere else in the image, say so with `anchor`: an isometric block whose floor diamond extends below the tile centre uses `{ x: 0.5, y: (wallHeight + tileHeight / 2) / (wallHeight + tileHeight) }`.

**Animated or reactive art:** pass a `props` factory to `<Stage>`. It receives each `PropDef` and returns a `PropDisplay` (`view`, optional `update(deltaMs, world)`, `destroy`). The renderer places `view` at the prop's position, sorts it, calls `update` every frame and destroys it on room change. Return `null` to fall back to the static `asset`.

```ts
const props: PropFactory = (prop, { world, projection }) => {
  if (prop.id !== "lamp") return null;
  const lampSprite = new Sprite(lampTexture);
  lampSprite.anchor.set(0.5, 1);
  return {
    view: lampSprite,
    update: () => (lampSprite.tint = world.flag("lamp_on") ? 0xffe0a0 : 0x707890),
    destroy: () => lampSprite.destroy(),
  };
};
```

A good split for reactive scenery: painted sprite underneath, code-drawn glow, runes or particles on top inside the same `view`.

### Hotspots over art

Hotspot shapes are room pixels: `{ rect: [x, y, w, h] }`, `{ polygon: [x0, y0, x1, y1, …] }`, or built from tiles with `tileArea(room, x, y, w, h, lift)`. `lift` raises the shape by that many pixels so it covers art standing on those tiles; set it to the art's height above the floor. Hotspots win over actors when picking, so don't make a tall hotspot overlap where an actor stands in front of it. Use `z` to settle overlaps between hotspots.

## 7. Characters

The renderer asks an `ActorFactory` for one display per actor, keyed by the actor's `sprite`. `placeholderActor(color, size)` is the stand-in; `sheetActor(spec)` is the classic grid spritesheet:

```ts
sheetActor({
  texture: await Assets.load("/art/ilo.png"),
  frameWidth: 24,
  frameHeight: 40,
  rows: { "down-right": 0, "down-left": 1, "up-right": 2, "up-left": 3, down: 4, up: 5, right: 6, left: 7 },
  walkFrames: [1, 2, 3, 4],
  idleFrame: 0,
  fps: 8,
  // anchor defaults to bottom-centre, the foot point
});
```

- **Pick rows from screen directions.** The display receives `screenFacing`, the direction as it appears on screen. In an isometric room a grid-axis step travels diagonally on screen, so **isometric characters live mostly in the four diagonals**. Draw those first.
- **Fallbacks:** a facing without a row falls back to its horizontal half (`down-left` → `left`), then its vertical half. Four rows (`down`, `up`, `left`, `right`) are enough for an orthogonal game.
- **No mirroring.** `sheetActor` doesn't flip frames, so draw left and right separately (or write a factory that flips).
- **Size:** about two tiles tall reads well: 16×32 frames for 16 px orthogonal tiles, 24×40 for 32×16 isometric tiles.
- **Height:** set `ActorDef.height` to how tall the sprite actually stands, in pixels. It decides which doorways and overhangs the character fits under (default: two tile heights), and the default click box height. Draw doorways, balconies and beams at heights that match: a doorway drawn one block high should have a `clearances` entry of one block, or the art and the walking disagree.
- **Foot point:** the anchor pixel is where the character stands. Keep it on the same pixel in every frame, or they'll swim.
- **Any other format** (Aseprite JSON tags, Spine, single PNGs) is a custom `ActorFactory`: return a `view` and an `update(view, deltaMs)` that reads `moving` and `screenFacing`.

## 8. Effects

- **Ground effects:** `renderer.layers.floor`. **Above-room effects:** `renderer.layers.world`. **Screen effects:** `renderer.layers.overlay`. See section 3 for order and cleanup.
- Drive them from `renderer.app.ticker` and read state from the world (`world.flag`, `world.actorViews()`, `world.ui.get()`).
- **Additive light:** `blendMode = "add"` on glows and threads lets overlaps brighten instead of painting over. It needs a **dark, low-contrast floor** to read, which is worth planning into the palette from the start.
- **Smooth textures** (radial glows, gradients) must opt out of nearest-neighbour: `texture.source.scaleMode = "linear"`.
- Graphics redrawn every frame are fine at this resolution. Batch a whole effect into one path and stroke it once rather than stroking per segment.

## 9. Multi-level rooms, interiors and fog

Rooms can stack floors (`levels`), connect them with `stairs`, and divide into `areas`: interiors that cut away while you're inside, and attached rooms hidden until first entered. LEVEL_DESIGN.md covers authoring; this is what the art needs.

### Heights

- A level's `elevation` is how far its floor sits above the base floor, **in screen pixels**. Draw raised floors that much higher than the same tile on the ground.
- **Make roofs meet walls.** A roof level's elevation should equal the room's wall height (`RoomDef.wallHeight`, used by the blockout and by the cutaway's maths), or the roof floats above the walls.
- Stair steps rise evenly from the lower floor to the upper one, so draw stairs with the same number of steps as `steps` tiles, plus the landing.
- Hotspots on a raised level: `tileArea(room, x, y, w, h, lift, level)` raises the shape to that floor.
- **Headroom under a raised floor is its elevation.** A balcony 32 px up lets a 32 px character walk beneath it and stops a taller one, so pick elevations with your characters' heights in mind.
- Tile-placed props on a raised level: give them `level`, and they're raised and sorted with it.

### What cutaways need from painted art

A cutaway fades **pieces**, not pixels. Anything that should fade while the player is inside must be its own piece:

- **Front walls, upper floors and the roof** of every interior are props, never part of the background. A prop placed by `tile` (with its `level`) fades when that tile is cut away. Art bigger than a tile or two, like a whole roof, should be listed by id in the area's `cover`, which fades it whenever the player is inside.
- **Back walls, and the floor inside,** can stay in the background: nothing hides them from inside.
- Paint walls with a top edge (a cap or a beam), so a room with its front walls faded still shows where they were.
- Expect the outside to be shaded at about 55% while the player is in a room. Keep exteriors readable at that darkness, and keep interiors lit enough to read as the bright place.

### Fog over attached rooms

Unrevealed areas are covered tile by tile with fog (the letterbox colour by default), reaching `headroom` pixels above the floor: the room's wall height, unless `areas.headroom` says otherwise. Walls in front of a fogged room still draw on top. Give attached rooms solid walls on the sides the player sees, so the fog reads as "a room you haven't been into" rather than a hole in the map.

### Tuning the look

```tsx
<Stage
  areas={{
    cutawayAlpha: 0.08, // what faded walls and roofs keep; 0 removes them entirely
    shadeColor: 0x000000,
    shadeAlpha: 0.55, // 0 turns the outside shade off
    fogColor: 0x0d1412, // default: the letterbox colour
    fogAlpha: 1,
    fadeMs: 350,
  }}
  …
/>
```

The demo's watchtower (`apps/demo`, open `?room=watchtower`) shows all of it in blockout: a hall cutaway with a doorway, two attached rooms revealed on entry, and stairs climbing past the doorway to a balcony and the roof.

## 10. Blockout palette

Rooms without art draw from the walkmap. Tune the look with `<Stage blockout={…}>`:

| Field | Used for | Default |
| --- | --- | --- |
| `floor` | walkable tiles, as a two-colour checker | `[0x3b5b4a, 0x416551]` |
| `blocked` | non-`'.'`, non-`'#'` tiles (floor under furniture) | `0x1d2a2a` |
| `wallTop` | `'#'` tiles, and the top face of raised walls | `0x35504a` |
| `wallLeft` / `wallRight` | the two visible faces of raised walls (isometric) | `0x2a3d3a` / `0x223230` |
| `wallHeight` | how far walls rise, in pixels (a room's own `wallHeight` wins) | one tile height |
| `slabThickness` | thickness of raised floors over walkable space | 4 |

A blockout palette close to the final art's values makes the blockout a useful preview of readability, not just layout. `blockout={false}` turns it off entirely, for games that draw rooms from runtime tiles.

## 11. Checklist for a room's art

- [ ] Painted at 1× logical pixels, room `(0, 0)` at the image's top-left
- [ ] Walkable floor in the art matches the debug overlay
- [ ] Everything an actor can walk behind is a prop, ≤ 2×2 tiles, with `depthTile` on its front-most tile
- [ ] Hotspot `lift` (or polygon) covers the visible art and not the floor in front of it
- [ ] Light from the upper left; left faces lighter than right faces
- [ ] Floor dark and calm enough for ground effects to read
- [ ] Character foot points on the same pixel in every frame
- [ ] Checked at 2×, at 4× and on a phone (fit scaling)
- [ ] Multi-level rooms: roof elevation equals wall height; interiors' front walls, upper floors and roof are props
- [ ] Each interior checked from inside: what fades, what stays, how the shaded outside reads

## Known gaps

- **Walk-behind masks** (SCUMM z-planes) and **Tiled / LDtk import** are on the roadmap in ARCHITECTURE.md.
