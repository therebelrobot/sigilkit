# Levels and stairs

Rooms don't have to be flat. A room can stack **levels** (a deck, a balcony, an upper floor, a roof), join them with **stairs**, and give each character a **height** so they only go where they fit. It's all still data on `RoomDef`.

Click the deck at the top of the yard and Wren walks over, climbs the steps and walks out onto it. Then use the buttons under the demo to send Wren and Pip the cat to the same places. Pip takes the low arch in the middle wall. Wren is too tall for it and goes around through the doorway.

## Levels

```ts
walkmap: [ /* the ground */ ],
levels: [
  { id: "deck", elevation: 16, walkmap: ["", "     ...", "     ...", "     ..."] },
],
```

- `walkmap` is the **base level**, called `"ground"` unless you set `baseLevel`.
- Each entry in `levels` adds a floor with its own walkmap on the same grid. Rows can be empty (`""`), and on a raised level anything except `.` and `#` is open air.
- `elevation` is how many pixels up the floor sits on screen.
- The ground under the deck is `k`, so it's blocked: the deck sits on something solid. Leave the ground walkable instead and the deck becomes a balcony you can walk under, if you're short enough.

Each level is its own pathfinding layer, so characters on different floors never bump into each other.

## Stairs

```ts
stairs: [{ to: "deck", steps: [{ x: 3, y: 2 }, { x: 4, y: 2 }], top: { x: 5, y: 2 } }],
```

`steps` are tiles on the lower level, bottom to top, and they rise evenly toward the upper level. `top` is the landing on the upper level, next to the last step. Chain stairs (`from: "deck", to: "roof"`) to climb further.

Characters change level **only** by stepping between the last step and the landing. That's why a floor passing next to the stairs never lifts anyone by accident. `walk` to a tile on another level plans the whole route: walk to the stairs, climb, carry on. Commands take a level too: `>>> walk wren 6 2 deck`.

## Heights and clearance

Every actor has a height in screen pixels. The default is two tile heights (32 px here, "two blocks"). Pip sets `height: 12`.

Headroom comes from two places:

- **Levels.** A floor above a tile limits how much room there is under it. The engine works this out from the elevations.
- **`clearances`**, for openings the levels don't describe. Here the arch is only 16 px high:

  ```ts
  clearances: [{ tiles: [{ x: 4, y: 5 }], height: 16 }],
  ```

Pathfinding, keyboard steps, stairs and walking up to someone all respect it. `world.fits(id, tile, level)` asks the question directly, and the readout under the demo shows it for Wren and the arch. If there's no route at all, `walk` gets as close as it can and resolves `false`.

## Hotspots on other levels

```ts
{ id: "telescope", shape: area(7, 1, 18, "deck"), standAt: { x: 6, y: 1 }, level: "deck", … }
```

`tileArea(…, level)` raises the shape to the deck's elevation, and `level` on the hotspot says which floor `standAt` is on. Clicking the telescope from the ground walks Wren up the stairs first.

## What you learned

- `levels` stack floors on the room's grid, and `elevation` raises them on screen.
- `stairs` are the only way between levels, and `walk` plans multi-level routes for you.
- `ActorDef.height` and `clearances` keep characters out of spaces they don't fit.
