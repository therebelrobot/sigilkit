# Levels, stairs and areas

A room can stack floors and divide itself into named spaces, still as data on `RoomDef`. This page is the reference. [Designing a room](/docs/level-design#7-levels-interiors-and-attached-rooms) covers how to lay these rooms out, and the [Levels](/learn/levels) and [Interiors](/learn/areas) lessons let you try them.

## Levels

```ts
walkmap: [ /* the base level */ ],
baseLevel: "ground", // the default
levels: [
  { id: "porch", elevation: 16, walkmap: ["", "", "", "", "", "", "    .     "] },
  { id: "roof", elevation: 48, walkmap: ["..........", "..........", /* … */] },
],
```

- `walkmap` is the **base level**. Each `LevelDef` adds a floor on the same grid, `elevation` pixels higher on screen.
- Rows can be empty. On raised levels, anything other than `.` and `#` is open air.
- Each level is its own pathfinding layer, so actors on different floors never collide.
- Blockout: a raised floor over walkable ground draws as a **slab** you can walk under. Over blocked ground it draws as a **solid block**.
- Set `wallHeight` to the roof's elevation so walls meet the roof.

## Stairs

```ts
stairs: [
  { to: "porch", steps: [{ x: 4, y: 8 }, { x: 4, y: 7 }], top: { x: 4, y: 6 } },
  { from: "porch", to: "roof", steps: [{ x: 4, y: 5 }], top: { x: 3, y: 5 } },
],
```

| Field | Meaning |
| --- | --- |
| `from` | Lower level. Default: the base level |
| `to` | Upper level |
| `steps` | Tiles on the lower level, bottom to top. Made walkable there, and rising evenly in elevation |
| `top` | The landing on the upper level, next to the last step |

Actors change level **only** by stepping between the last step and `top`. The world animates that step itself, so a floor passing beside or under a staircase never lifts anyone by accident. `walk()` to a tile on another level plans the route: walk to the nearest stairs, climb, repeat, then walk to the target. Stick and keyboard play climb by pushing toward the landing.

## Heights and clearance

`ActorDef.height` is how tall a character stands (default two tile heights). The **clearance** over a tile is the headroom up to the nearest floor, step or wall above it, plus any `clearances` entries:

```ts
clearances: [{ tiles: [{ x: 5, y: 6 }], height: 16 }], // a cat flap
```

`world.fits(id, tile, level)` combines the two. Pathfinding, stick steps, stair climbs and "walk up beside" all respect it. A character too tall for a doorway routes around it, or stops at the closest tile it can reach, and `walk` resolves `false`. The blockout draws a lintel over low openings.

## Elevation in views and picking

- `ActorView` carries `level` and `elevation`, both already applied to `screen`, and a `sortY` draw key that sorts raised things in front of what stands beneath them.
- `world.pickTile(point)` tests stair steps first, then levels from the top down, skipping anything cut away or fogged.
- Entries, actor placements, props and hotspots take a `level`. `tileArea(room, x, y, w, h, lift, level)` raises a hotspot shape to a floor.

## Areas

```ts
areamap: [
  "          ",
  " hhhh aaa ",
  " hhhh aaa ",
],
areas: [
  { id: "hall", key: "h", name: "the hall", interior: true },
  { id: "annex", key: "a", interior: true, reveal: "once", onEnter: "annex_enter", cover: ["annex-roof"] },
],
```

`areamap` (and `LevelDef.areamap` per level) tags tiles with letters. Spaces and `.` mean "no area". Each `AreaDef`:

| Field | Meaning |
| --- | --- |
| `id`, `key`, `name` | Identity, its letter in areamaps, and a display name |
| `interior` | Cut away while the player is inside |
| `reveal` | `"always"` (default), `"once"` (fogged until first entered, then saved) or `"inside"` (visible only while inside) |
| `cover` | Prop ids that cover it (painted roofs, front walls), faded during cutaway |
| `onEnter` | Handler run each time the player walks in |

The world tracks the player's area every update, emits `areaChanged`, and runs `onEnter`.

### Cutaways

While the player is in an interior, `world.isCutAway(level, x, y)` is true for its front walls, everything on higher levels above its walls and floor, and anything else in front of it on screen that would hide it. The renderer fades every room piece (walls, slabs, risers, props) on those tiles, plus `cover` props, and shades everything outside the interior. Hotspots and actors under cut-away tiles can't be picked or focused.

### Fog

Areas that aren't revealed have their floor under fog and every piece and actor in them hidden. Their walls stay, so the building's shape shows but not its contents. `world.isAreaRevealed(id)`, `world.revealArea(id)` and `>>> reveal <area>` manage it, and revealed areas are saved in `WorldState.revealed`.

### Tuning the look

```tsx
<Stage areas={{ cutawayAlpha: 0.08, shadeColor: 0x000000, shadeAlpha: 0.55, fogColor: 0x0d1412, fogAlpha: 1, fadeMs: 350 }} />
```

`headroom` sets how far above each floor tile the shade's cut-out reaches (default: the room's wall height).

## Queries

```ts
world.levelOf(id);              // "ground"
world.layout.isMultiLevel;      // boolean
world.layout.walkable(level, x, y);
world.layout.clearanceAt(level, x, y);
world.areaOf(id?);              // AreaDef | null (default: the player)
world.cutaway();                // the interior being cut away, or null
world.isCutAway(level, x, y);
world.isAreaRevealed(areaId);
```

All of it is headless and testable. See [Testing headlessly](/docs/testing).
