# Hotspots and verbs

A room gets interesting when there's something in it to click. In sigilkit, clickable things are **hotspots**: shapes in room pixels, each with a set of verbs it answers to.

Try the demo. Click the planter and Wren walks over, turns to face it, and looks at it. Choose **Use** in the verb bar, then click the planter again. Right-click (or long-press on a phone) anywhere for the **verb coin**, a ring of verbs at that spot. Try **Take** on the skylight to see the fallback line.

## A hotspot

```ts
{
  id: "planter",
  name: "dry planter",                // shown on hover: "Look at dry planter"
  shape: area(3, 3, 2, 2, 6),         // where you can click, in room pixels
  standAt: { x: 4, y: 5 },            // walk here first
  face: "up",                         // then face this way
  verbs: {
    look: ({ world }) => world.say("wren", "The soil's cracked…"),
  },
}
```

### Shapes live in pixels

Hotspot shapes are in **room pixel space**, not tiles, because in a finished game they're drawn over painted art that doesn't follow a grid. A shape is either `{ rect: [x, y, w, h] }` or `{ polygon: [x0, y0, x1, y1, …] }`.

Most of the time you'll use `tileArea(room, x, y, w, h, lift)`, which makes a polygon covering a block of tiles. `lift` raises its top edge by that many pixels, so the shape also covers art that stands up from the floor (a bench, a door frame). Because `tileArea` asks the room's projection where tiles are, the same call works in an [isometric room](/learn/isometric).

`tileArea` needs the room's projection and tile size, so the room's data is split in two: `greenhouseBase` holds everything except hotspots, and `defineRoom` combines it with the hotspots built from it. `satisfies Omit<RoomDef, "hotspots">` keeps that first half type-checked.

Press **Debug** to see each hotspot's outline.

## Verbs and handlers

`verbs` maps a verb to a **handler**. A handler is one of two things:

- **A function** `(ctx) => void | Promise<void>`. `ctx` holds the `world`, the `target` id, the `verb`, and the `item` if one was used. This lesson uses functions.
- **A string**: a story path for the installed script runner, which is an Ink knot once you add `sigilkit/story`. That's [the next lesson](/learn/ink-dialog).

`world.say(speaker, text)` shows a line and returns a promise that resolves when the player clicks past it. An `async` handler can `await` several in a row. While any handler runs the world is **busy**: clicks are ignored until it finishes, so the player can't wander off mid-sentence.

## Which verb runs

When you click a hotspot:

1. If a verb is selected in the verb bar (anything except **Walk**), that verb runs.
2. Otherwise the hotspot's own `default` verb runs. The door sets `default: "walk"`, so clicking it tries to leave.
3. Otherwise `game.defaultVerb` runs (`"look"` here).

Then the player walks to `standAt` (if it's set), turns to `face` (or toward the shape's centre), and the handler runs. If the hotspot has no handler for that verb, the player says `game.fallback(verb, target)` instead.

The verbs on offer come from `game.verbs`, which defaults to `walk`, `look`, `use`, `talk` and `take`. Give a game a different list and the verb bar and verb coin follow it.

## Two more fields

- `when: (world) => boolean` hides the hotspot unless it returns true. You'll use it in [Items](/learn/items) to remove something once it's been picked up.
- `z` decides which hotspot wins where shapes overlap. The higher one gets the click.

## What you learned

- Hotspots are pixel shapes with verbs. `tileArea` builds the shape from tiles.
- Handlers are functions or story paths. While one runs, the world is busy.
- A click uses the selected verb, then the hotspot's `default`, then `game.defaultVerb`. A verb with no handler falls back to `game.fallback`.
