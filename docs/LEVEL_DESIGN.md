# Designing and building a room

A sigilkit "level" is a **room**: a walk grid, things to interact with, the story behind them, and the exits to other rooms. This guide goes from an idea to a playable, art-ready room. VISUAL_DESIGN.md and AUDIO_DESIGN.md cover the art and sound passes in depth.

The order matters: **design on paper, block out, make it playable, then add art and sound.** A room that's fun as coloured diamonds will be fun painted. A room that isn't fun won't be rescued by art.

## 1. Design on paper

Answer these before opening an editor. A short markdown file per room next to the content is a good home for them.

- **Purpose:** what does this room do for the story? Introduce someone, teach a mechanic, gate progress, reward?
- **Beats:** the three to six things that happen here, in the order a player is most likely to meet them.
- **Puzzle dependencies:** for each goal, what does the player need first? Draw it as a chart, with arrows from what you need to what it unlocks. Look for:
  - dead ends (something needed but never obtainable after a choice)
  - a single long chain (the player has nothing to do while stuck; give them two or three open threads at once)
  - things that unlock before the player could understand why they'd want them
- **Hotspots:** every interactive thing, with a one-line answer for each verb the game has (`look`, `use`, `talk`, `take` by default). The fallback line covers the rest, but things worth looking at deserve their own line.
- **Exits:** where each one leads, and which entry point it arrives at on the other side.
- **State:** the flags this room sets and reads. Name them for what's true in the world (`hatch_open`), not for what the player did (`used_hatch`).

## 2. Choose projection and size

| | Orthogonal | Isometric |
| --- | --- | --- |
| Good for | painted SCUMM-style scenes, side-on rooms, interiors with a back wall | dioramas, workshops, rooms seen from above at an angle |
| Tile | 16×16 at 320×180 | 32×16 (2:1) |
| Grid | about 20×11 fills 320×180 | about 9×9 fills 320×180 with headroom for walls |
| Movement | `directions: 4` is fine | `directions: 8`, so stick-up is one step |

Rooms bigger than the frame scroll; the camera follows the player. Keep the first rooms one screen: scrolling rooms are harder to read and harder to paint.

Isometric sizing:

- floor footprint = `(cols + rows) · 16` wide × `(cols + rows) · 8` tall for 32×16 tiles
- `origin` = the top corner of tile (0, 0); push it down by your wall height
- `size` = the full picture, walls included

## 3. Write the walkmap

One string per row, one character per tile:

| Character | Means | Blockout draws |
| --- | --- | --- |
| `.` | walkable floor | checker floor |
| `#` | wall | raised wall in isometric, flat in orthogonal |
| anything else | blocked floor (furniture, props, holes) | dark floor; your prop draws the thing |

Use a letter that says what the thing is (`o` for objects, `t` for table, `w` for water). Annotate the rows so coordinates are easy to read off:

```ts
//          x: 012345678
walkmap: [
  /* y0 */ "#########",
  /* y1 */ "#..tt....",
  /* y2 */ "#..tt....",
  /* y3 */ "#........",
  /* y4 */ "#.....o..",
],
```

Rules that save time later:

- **Close the edges** with walls or blocked tiles, unless an exit is meant to be there.
- **Every `standAt` and every entry must be walkable and reachable** from the rest of the floor.
- **Actors block tiles.** NPCs collide with the player, so don't put an NPC in a one-tile corridor that the player has to pass through.
- **Leave a free tile in front of everything interactive.** That's where the player stands to use it.
- **Two tiles of clear floor** around anything with a big visual effect gives the effect room to read.

## 4. Define the room

Rooms are plain data. Because `tileArea` needs the room's grid to build hotspot shapes, define the room in two halves: a `base` without hotspots, then the full room.

```ts
import { defineRoom, tileArea, type RoomDef } from "sigilkit";

const galleriesBase = {
  id: "galleries",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  origin: { x: 160, y: 30 },
  size: { width: 320, height: 180 },
  walkmap: [
    "#########",
    "#..tt....",
    "#..tt....",
    "#........",
    "#.....o..",
  ],
  entries: {
    stairs: { at: { x: 6, y: 1 }, facing: "down" }, // arriving from the workshop hatch
  },
  actors: { archivist: { at: { x: 6, y: 3 }, facing: "left" } },
  props: [
    { id: "table", tile: { x: 3.5, y: 1.5 }, depthTile: { x: 4, y: 2 } },
    { id: "chest", tile: { x: 6, y: 4 } },
  ],
  music: "galleries",
  onEnter: "galleries_enter",
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, w = 1, h = 1, lift = 0) =>
  tileArea({ ...galleriesBase, hotspots: [] }, x, y, w, h, lift);

export const galleries = defineRoom({
  ...galleriesBase,
  hotspots: [
    {
      id: "chest",
      name: "iron chest",
      shape: area(6, 4, 1, 1, 18),
      standAt: { x: 5, y: 4 },
      face: "right",
      default: "use",
      verbs: { look: "chest_look", use: "chest_use" },
    },
    {
      id: "stairs",
      name: "stairs up",
      shape: area(6, 0, 1, 1, 30),
      standAt: { x: 6, y: 1 },
      default: "walk",
      verbs: { walk: "galleries_exit_stairs", look: "stairs_look" },
    },
  ],
});
```

Then add it to the game: `rooms: { workshop, galleries }`.

### Hotspot fields

| Field | Use it for |
| --- | --- |
| `id` | the stable name scripts and focus use |
| `name` | what the hover label and sentence line show ("Use key with *iron chest*") |
| `shape` | `tileArea(…)` for tile-aligned things; `{ polygon: […] }` traced from painted art |
| `standAt` | where the player walks before acting; omit to act from where they are |
| `face` | which way they turn to act |
| `default` | the verb for a plain tap, A button or Enter. Doors: `walk`. Things: `look` or `use` |
| `verbs` | verb → Ink knot name, or a TypeScript function |
| `when` | `(world) => boolean`; hide the hotspot until it applies (a dropped item, an opened door) |
| `z` | which hotspot wins where shapes overlap |

## 5. Connect rooms

Exits are hotspots whose verb runs a `goto`:

```ink
=== galleries_exit_stairs ===
>>> goto workshop hatch
-> END
```

`goto <room> <entry>` loads the room and places the player at that entry. Name entries after **where the player came from** (`hatch`, `stairs`, `front-door`), so each side of a doorway reads naturally. An entry the room doesn't define falls back to the first one.

Both sides of a doorway need:

- a hotspot on this side that `goto`s the other room's entry
- an entry on the other side standing **next to** that room's matching exit, facing away from it, so the player doesn't immediately re-trigger it

## 6. Write the story

Knots are named `<thing>_<verb>`, with `<room>_enter` for arrival. Flags the story reads or writes are declared twice, once in the game and once in Ink, and kept in sync both ways:

```ts
flags: { chest_open: false, met_archivist: false },
```

```ink
VAR chest_open = false

=== galleries_enter ===
{ galleries_enter == 1:
    Dust, and a smell like old paper. Someone has kept the lamps lit down here.
}
-> END

=== chest_use ===
{ chest_open:
    Ilo: Empty, now.
    -> END
}
{ has_item("iron_key"):
    >>> sfx chest-open
    ~ chest_open = true
    Ilo: It swings open with a sigh.
- else:
    Ilo: Locked. The keyhole is shaped like a leaf.
}
-> END
```

- **Speech:** `Name: line`, matching an actor's id or display name. Lines without a speaker are narration.
- **Commands:** `>>> walk`, `face`, `say`, `wait`, `goto`, `give`, `take`, `set`, `show`, `hide`, `place`, `music`, `sfx`, plus anything the game registers with `world.commands.set`.
- **Reading the world:** `has_item("x")`, `flag("x")`, `target()`, `verb()`, `held_item()`.
- **First visit only:** `{ knot_name == 1: … }` (Ink counts visits).
- **Choices:** `+ [Ask about the key]`, with `{ condition }` guards, and a loop label (`- (opts)` … `-> opts`) for conversation hubs.
- **Items used on things:** `items.iron_key.with.chest = "chest_unlock"` in the game definition.

Write every line a player could reach. Do `look` for everything first: it's the cheapest way to make a room feel inhabited.

## 7. Playtest the blockout

Run the game with the debug overlay on (`renderer.setDebug(true)`). Then:

- [ ] Walk to every hotspot by **tap**, by **stick** and by **keyboard**, from both far corners
- [ ] Focus cycling (RB/LB, Tab) reaches everything interactive, in a sensible order
- [ ] Every verb on every hotspot says something, including the fallback
- [ ] Every exit lands on the right entry and doesn't bounce the player back
- [ ] Save, reload, and the room's state is still right (`world.serialize()` / `world.load()`)
- [ ] Someone who didn't design the room can finish it without hints, or with only the hints the room gives

## 8. Test it headlessly

Rooms are data, so the rules that matter can be tested without a browser. Step world time until a promise settles:

```ts
import { describe, expect, it } from "vitest";
import { World } from "sigilkit";
import { game } from "../src/game/game";

async function runUntilSettled<T>(world: World, pendingResult: Promise<T>, maximumMilliseconds = 10_000): Promise<T> {
  let settled = false;
  let settledValue!: T;
  void pendingResult.then((value) => {
    settled = true;
    settledValue = value;
  });
  for (let elapsedMilliseconds = 0; elapsedMilliseconds < maximumMilliseconds && !settled; elapsedMilliseconds += 16) {
    world.update(16);
    await Promise.resolve();
    await Promise.resolve();
  }
  if (!settled) throw new Error("timed out");
  return settledValue;
}

describe("galleries", () => {
  it("can reach every hotspot's stand tile", async () => {
    for (const hotspot of game.rooms.galleries.hotspots) {
      if (!hotspot.standAt) continue;
      const world = new World(game, { room: "galleries", autoAdvanceMs: 1 });
      world.start();
      expect(await runUntilSettled(world, world.walk(world.player, hotspot.standAt)), hotspot.id).toBe(true);
    }
  });
});
```

Story knots run in tests too: install the `InkRunner` with the compiled story and call `world.interact("chest", "use")`, then assert on flags.

## 9. Art and sound passes

When the blockout plays well:

1. **Art** (VISUAL_DESIGN.md): trace the debug overlay, paint the background, cut anything actors walk behind into props, set `background`, adjust hotspot `lift`s to the real art.
2. **Sound** (AUDIO_DESIGN.md): the room's `music` loop, an `sfx` for every state change, dialog blips or voice.
3. **Playtest again.** Painted art changes how readable the room is: hotspots that were obvious as coloured blocks can disappear into a detailed painting.

## 10. Final checklist

- [ ] Room registered in `game.rooms`; every entry used by a `goto` exists
- [ ] Every flag declared in `game.flags` and as a `VAR` in Ink
- [ ] Every knot named in `verbs`, `onEnter` and `items.*.with` exists in the Ink (a missing one shows as an `error` event when used)
- [ ] Every `standAt` and entry is walkable and reachable (a test covers it)
- [ ] Nothing interactive is hidden behind a prop or an NPC
- [ ] Music, effects and art in place, or deliberately blockout for now
