# Actors and movement

Actors are the characters: the player, NPCs, a cat, other players in multiplayer. Each is defined once on the game, placed in a room, and moved by the world's pathfinding.

## Defining actors

```ts
actors: {
  wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
  moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk", look: "moth_look" } },
  pip: { name: "Pip", sprite: "cat", height: 12 },
},
```

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `string` | Shown on hover and in the sentence line. Ink's `Name:` lines match it |
| `sprite` | `string` | Key the renderer's actor factory turns into art |
| `speed` | `number?` | Tiles per second. Default 4 |
| `color` | `string?` | Dialog colour hint for the UI |
| `verbs` | `Record<verb, Handler>?` | Makes the actor clickable. Clicking uses `talk` by default |
| `hitbox` | `[width, height]?` | Pick box above the foot point, in pixels. Default: one tile wide, `height` tall |
| `height` | `number?` | How tall the actor stands, in screen pixels. Default two tile heights. See [clearance](/docs/levels-and-areas#heights-and-clearance) |

## Placing actors

The player starts at the start room's entry. Other actors start where a room's `actors` field puts them:

```ts
actors: { moth: { at: { x: 11, y: 7 }, facing: "left" } },
```

An `ActorPlacement` is `{ at, facing?, level? }`. Each actor lives in exactly one room. `world.state.actors[id].room` says which, and it's remembered when the player leaves.

## Moving actors

| Method | Command | Does |
| --- | --- | --- |
| `world.walk(id, { x, y, level? })` | `walk id x y [level]` | Pathfind there. Resolves `true` on arrival, `false` if it stopped short |
| `world.place(id, { x, y, level? })` | `place id x y [level]` | Put the actor there instantly |
| `world.face(id, facing)` | `face id facing` | Turn. Facings are `up`, `down`, `left`, `right` and the four diagonals |
| `world.setVisible(id, visible)` | `show id` / `hide id` | Hide or show |
| `world.stepToward(id, direction)` | | One step toward a screen-space direction (stick and keyboard play) |

`walk` handles a lot for you:

- **Blocked destinations** walk to the closest reachable tile instead.
- **Other actors** are obstacles. Walking to an actor's own tile stops beside them.
- **Another level** in a multi-level room plans the whole route through stairs.
- **A newer walk** for the same actor cancels the rest of the old one.
- **Walkability changes** mid-walk (a door shutting) re-plan the route and keep the same promise.
- **Clearance**: an actor never goes where it doesn't fit.

## Querying

```ts
world.tileOf("wren");          // { x, y }
world.levelOf("wren");         // "ground"
world.heightOf("wren");        // 32
world.fits("wren", tile, level); // is there headroom?
world.actorsInRoom();          // ids in the current room
world.areaOf("wren");          // AreaDef | null
```

## ActorView: what the renderer draws

`world.actorViews()` returns one `ActorView` per actor in the room, interpolated between tiles and projected into room pixels. Any renderer can draw from it:

| Field | Meaning |
| --- | --- |
| `id`, `sprite` | Which actor, and its art key |
| `screen` | Foot point in room pixels, with elevation already applied |
| `facing` | Grid-space facing: what scripts and `face` use |
| `screenFacing` | The same direction as it appears on screen. Pick sprite rows from this |
| `moving` | Mid-step |
| `visible` | Not hidden |
| `level`, `elevation` | Which floor, and how many pixels it raises the actor |
| `sortY`, `depth` | Draw-order keys. Larger draws in front |
| `area` | Area the actor stands in |

In an isometric room, walking grid-right travels down-right on screen. `facing` says `right`, and `screenFacing` says `down-right`.

## Adding actors at runtime

```ts
world.addActor("ghost", { name: "Ghost", sprite: "ghost", speed: 2 }, { at: { x: 5, y: 5 } });
world.removeActor("ghost");
```

The multiplayer client uses this for other players, and games use it for spawned NPCs. The definition is added to this world's copy of the actor table, so the shared game object isn't touched.

## Art

The renderer turns `sprite` keys into displays through an **actor factory** you give `<Stage actors={…}>`. `placeholderActor(color)` draws a capsule with a facing dot, which is enough to block out a game, and `sheetActor` animates a classic spritesheet. See [Rendering](/docs/rendering#actors).
