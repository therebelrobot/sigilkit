# Doors and walkability

So far walkmaps have been fixed. Real places change: doors open and shut, a rockfall blocks a passage, a bridge burns. sigilkit has two tools for this. **Doors** are tiles whose walkability follows a flag. **`setWalkable`** changes any tile for good.

Moth is patrolling the cellar. Shut the gate with the button under the demo (or click the gate in the room) while Moth is heading for it, and Moth turns around and goes through the lower gap instead. Then block the gap too, and Moth stops as close as it can get.

## Doors

```ts
walkmap: [ …, "#..................#", … ],   // the gate tile is '.'
doors: [{ id: "gate", tiles: [{ x: 9, y: 5 }], openWhen: "gate_open" }],
```

Write a door's tiles as walkable in the walkmap. The door makes them unwalkable while it's shut. `openWhen` is either:

- **a flag name.** The door is open while the flag is truthy, so the story opens it with `~ gate_open = true` or `>>> set gate_open true`. Declare the flag in `game.flags` (and as an Ink `VAR`) with its starting value.
- **a function** `(world) => boolean`, for anything else: `(world) => world.has("winch_handle")`. It's checked every frame.

A door can cover several tiles (a double door, a portcullis, a bridge) and can sit on any level. Shut doors draw in the blockout as door-coloured blocks. Painted rooms show them with a prop. Give each door a hotspot so the player can use it, as with the gate here.

## Changing tiles for good

```ts
world.setWalkable({ x: 9, y: 8 }, false); // a rockfall
world.setWalkable({ x: 9, y: 8 }, true);  // dug out
world.setWalkable({ x: 9, y: 8 }, null);  // back to how the room was authored
```

```ink
>>> block 9 8
>>> unblock 9 8
```

These changes are saved with the game (`WorldState.walkable`) and override doors on the same tile. Every change, from a door or from `setWalkable`, emits `walkableChanged`. The inspector's **Events** tab shows them.

## People react

Nothing in **patrol.ts** knows about the gate. It only walks Moth back and forth. Any walk in progress re-plans the moment walkability changes, and keeps the same promise:

- If another way exists, the actor goes round.
- If a new way just opened, the actor takes it.
- If there's no way at all, the actor stops at the closest reachable tile and the `walk` promise resolves `false`.

Pathfinding reads walkability live, so there's no cache to invalidate and no "rebuild the navmesh" step.

## Dungeons

A floor of a dungeon is usually one room: each chamber is an [area](/learn/areas) (`reveal: "once"` for map memory, or `"inside"` for torchlight), joined by doorways, with `doors` where they open and shut. Split very large dungeons into several rooms joined with `goto` at natural breaks such as stairwells.

## What you learned

- `doors` make tiles walkable only while a flag (or a function) says they're open.
- `setWalkable`, or `>>> block` and `>>> unblock`, change tiles permanently and are saved.
- Walks re-plan automatically when walkability changes, so NPCs just cope.
