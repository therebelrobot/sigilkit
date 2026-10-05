# Interiors and fog

In an isometric room the walls in front of a building hide what's inside it. sigilkit handles this with **areas**: named groups of tiles that can be **interiors**, which cut away while you're inside, and that can stay hidden under **fog** until you first walk in.

Walk Wren through the front door into the hall. The front walls fade, the outside is shaded, and the hall becomes the room you're looking at. The space to the right is under fog. Walk through the inner doorway to discover the annex, and watch the readouts under the demo.

## Tagging tiles with an areamap

```ts
areamap: [
  "          ",
  " hhhh aaa ",
  " hhhh aaa ",
  " hhhh aaa ",
],
areas: [
  { id: "hall", key: "h", name: "the hall", interior: true },
  { id: "annex", key: "a", name: "the annex", interior: true, reveal: "once", onEnter: "annex_enter" },
],
```

The areamap lines up with the walkmap, one letter per tile, and `key` connects a letter to an area. Spaces (and `.`) mean the tile is in no area. Multi-level rooms give each level its own `areamap`.

The world tracks which area the player is in every frame. It emits `areaChanged` when that changes and runs the area's `onEnter`.

## Interiors cut away

While the player stands in an `interior: true` area:

- its **front walls** fade, along with anything on higher levels above it, such as a roof or an upper floor
- anything else **in front of it on screen** fades too, like a balcony over the door
- props listed in the area's `cover` fade, which is how painted roofs and walls get out of the way
- everything **outside** the area is shaded, so the room you're in is the bright one
- hotspots and actors under faded parts can't be clicked

For clean cutaways, enclose each interior with walls, and put doorways in the wall line **outside** any area, as both doorways here are.

`<Stage areas={{ cutawayAlpha, shadeAlpha, fadeMs, … }}>` tunes how it looks.

## Rooms revealed as you go

`reveal` decides when an area's contents can be seen:

| `reveal` | Hidden | Good for |
| --- | --- | --- |
| `"always"` (default) | never | ordinary spaces |
| `"once"` | under fog until first entered, then for good (saved with the game) | rooms you discover |
| `"inside"` | whenever the player isn't in it | dark caves, cupboards, torchlit dungeons |

A hidden area's walls still draw, so you can see the shape of the building but not what's in it. Its hotspots and actors can't be clicked or focused. That's why the chest in the annex can't be examined from outside. `>>> reveal annex` lifts the fog from a script, for a map, a window or a story beat. The button under the demo runs that command.

## Testing it

All of this is headless. `world.areaOf()`, `world.cutaway()`, `world.isCutAway(level, x, y)` and `world.isAreaRevealed(id)` work in a test exactly as they do here. See [Testing headlessly](/learn/testing).

## What you learned

- An `areamap` tags tiles, and `areas` names them and gives them behaviour.
- `interior: true` cuts away walls in front and shades the outside while you're in.
- `reveal: "once"` and `"inside"` keep areas under fog, and `>>> reveal` lifts it.
