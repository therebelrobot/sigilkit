# Doors and walkability

Walkmaps describe a room as authored. Two tools change it at runtime: **doors**, whose tiles follow a flag or a function, and **`setWalkable`**, for permanent changes.

## Doors

```ts
walkmap: [ …, "#....#....#", … ], // write door tiles as '.'
doors: [
  { id: "cellar-door", tiles: [{ x: 5, y: 2 }], openWhen: "cellar_door_open" },
  { id: "portcullis", tiles: [{ x: 9, y: 4 }, { x: 10, y: 4 }], openWhen: (world) => world.has("winch_handle") },
],
```

| Field | Meaning |
| --- | --- |
| `id` | Name, for `world.isDoorOpen(id)` |
| `tiles` | One tile for a door, two for a double door, a row for a portcullis or a bridge |
| `level` | Level the tiles are on. Default: the base level |
| `openWhen` | A flag name (open while truthy) or `(world) => boolean` (checked every frame) |

A door's tiles are walkable only while it's open. Open it from Ink:

```ink
=== cellar_door_use ===
{ has_item("iron_key"):
    >>> sfx door-unlock
    ~ cellar_door_open = true
- else:
    Wren: Locked.
}
-> END
```

Declare the flag in `game.flags` and as an Ink `VAR`. Give each door a hotspot, using `when` to hide it once it's open if it has nothing more to say. In the blockout, shut doors draw as door-coloured blocks (`blockout.door`). In painted rooms, show them with a prop that reads the flag.

## Permanent changes

```ts
world.setWalkable({ x: 4, y: 7 }, false);         // a rockfall
world.setWalkable({ x: 4, y: 7, level: "roof" }, true);
world.setWalkable({ x: 4, y: 7 }, null);          // hand the tile back to the room and its doors
world.setWalkable({ x: 4, y: 7 }, false, "cellar"); // a room other than the current one
```

```ink
>>> block 4 7
>>> unblock 4 7 roof
```

These are saved in `WorldState.walkable` and override doors on the same tile. The blockout floor recolours. Painted art needs a prop that shows the change.

## Walks re-plan

Pathfinding reads walkability live, so a change takes effect immediately. Actors mid-walk stop and re-plan from where they are, keeping the same promise:

- going round if there's another way
- through, if a way just opened
- or as close as they can get, with `walk` resolving `false`

So a door slamming in front of an NPC sends it the other way, and nothing in the NPC's code needs to know about doors. Every change emits `walkableChanged` with the affected tiles, and the cutaway is recomputed.

## Multiplayer

In the shared-presence model, flags are per client, so a door opened by one player's flag doesn't exist on the server, and it blocks nothing there. Doors that should open for everyone need server-owned flags. See [Multiplayer](/docs/multiplayer#beyond-shared-presence).
