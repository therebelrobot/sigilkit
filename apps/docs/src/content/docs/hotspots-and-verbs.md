# Hotspots and verbs

Hotspots are the clickable things in a room: shapes in room pixels, each answering a set of verbs. Verbs are just strings, and a game chooses which ones it offers.

## HotspotDef

```ts
{
  id: "planter",
  name: "dry planter",
  shape: tileArea(base, 3, 5, 3, 2, 6),
  standAt: { x: 4, y: 7 },
  face: "up",
  default: "use",
  verbs: { look: "planter_look", use: "planter_use", take: ({ world }) => world.say("wren", "It's heavy.") },
  when: (world) => !world.flag("planter_gone"),
  z: 1,
}
```

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Used by `items[…].with`, `world.interact` and focus |
| `name` | `string` | Shown on hover: "Look at dry planter" |
| `shape` | `Shape` | Where to click, in room pixels |
| `verbs` | `Record<verb, Handler>` | What each verb does |
| `standAt` | `TilePos?` | Walk here before acting. Omit to act from wherever the player stands |
| `face` | `Facing?` | Face this way after arriving. Default: toward the shape's centre |
| `default` | `string?` | Verb for a plain click. Default: `game.defaultVerb` |
| `when` | `(world) => boolean` | Hide the hotspot unless this returns true |
| `z` | `number?` | Higher wins where shapes overlap |
| `level` | `string?` | Level `standAt` is on, in a multi-level room |

## Shapes

```ts
{ rect: [x, y, width, height] }
{ polygon: [x0, y0, x1, y1, x2, y2, …] }
```

Shapes are in room pixels, because in a finished game they're drawn over painted art. `tileArea(room, x, y, w = 1, h = 1, lift = 0, level?)` builds a polygon covering a block of tiles in the room's projection, raised by `lift` pixels so it also covers the art standing on them. It keeps hotspots correct in both orthogonal and isometric rooms. The renderer's debug overlay (`<Stage debug>` or `renderer.setDebug(true)`) outlines every hotspot.

## Handlers

```ts
type Handler = string | ((ctx: ScriptContext) => void | Promise<void>);

interface ScriptContext {
  world: World;
  target: string;  // the hotspot, actor or item acted on
  verb: string;
  item?: string;   // the held item, for "use X with Y"
}
```

- A **string** is a story path for the script runner. With `InkRunner`, it's a knot name.
- A **function** is TypeScript, for anything the story layer shouldn't own: a minigame, a puzzle checked in code, analytics.

Handlers can be async, and the player stays **busy** until they finish. If a handler throws, the world emits an `error` event and play continues.

## What a click does

```
click ──► world.activate(point)
            │ pick(): hotspot (highest z) ► actor ► floor tile
            ▼
     floor: walk(player, tile)
     target: verb = selected verb, or target's default, or game.defaultVerb
            ▼
     interact(): busy ► walk to standAt ► face ► handler ► not busy
```

1. **Picking.** Visible hotspots under the point (highest `z` first), then actors (front-most first), then the floor tile.
2. **The verb.** The verb selected in the verb bar if it isn't `walk`. Otherwise the hotspot's `default`, then `game.defaultVerb`. Actors default to `talk`.
3. **Holding an item?** `items[held].with[target]` wins if it exists. Otherwise the target's `use` handler.
4. **No handler?** The player says `game.fallback(verb, target)`.

`world.interact(targetId, verb, item?)` runs steps 3–4 directly, which is handy in tests and from scripts.

## Choosing verbs

There are three ways at once, so it works on any device:

- **Tap or click** uses the target's default verb.
- **The verb bar** selects a verb for the next click.
- **Long-press** (touch) or **right-click** opens the verb coin, a ring of verbs at that point.

Gamepad and keyboard players act on the **focused** target instead: A or Enter uses its default verb, and X or L looks. See [Gamepad and keyboard](/docs/input).

Set `game.verbs` to change what's offered. A game with only `["walk", "use"]` gets a two-button verb bar, and every click on a hotspot uses it.

## Hiding and revealing

- `when` hides a hotspot unless a condition holds. Use it for things that get picked up or appear later.
- Hotspots whose `standAt` is under fog or a cutaway can't be clicked or focused. See [Levels, stairs and areas](/docs/levels-and-areas).

`world.hotspots()` returns the hotspots that are usable right now.

## Actors as targets

Actors with `verbs` on their `ActorDef` are clickable too. The player walks up beside them (pathfinding stops next to an occupied tile), and the two face each other before the handler runs.
