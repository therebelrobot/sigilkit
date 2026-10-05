# Items, inventory and flags

Two kinds of state carry a story forward: the **inventory** (things the player holds) and **flags** (everything else the game remembers). Both live in `world.state` and are saved with the game.

## Items

```ts
items: {
  can: {
    name: "watering can",
    icon: "can",
    verbs: { look: "can_look" },
    with: { planter: "planter_water", "planter-box": "box_water", moth: "moth_water" },
  },
},
```

| Field | Meaning |
| --- | --- |
| `name` | Shown in the inventory and the sentence line: "Use watering can with dry planter" |
| `icon` | Key your inventory UI can turn into an image (see `InventoryBar`'s `renderIcon`) |
| `with` | Target id (a hotspot or an actor) → handler, for "use this with that" |
| `verbs` | Handlers for verbs used on the item itself, for custom inventory UIs |

### The inventory

| TypeScript | Ink | Does |
| --- | --- | --- |
| `world.give("can")` | `>>> give can` | Add (once) |
| `world.take("can")` | `>>> take can` | Remove |
| `world.has("can")` | `has_item("can")` | Check |
| `world.state.inventory` | | The list, in order received |

### Using items

`world.holdItem("can")` (what clicking an inventory slot does) selects the item and switches the verb to `use`. The next click on a target runs `items.can.with[target]`, or the target's own `use` handler if there's no `with` entry, or the fallback line. After a handler runs, the item is put away. Clicking the floor, pressing Escape, or B on a gamepad puts it away too.

## Flags

Flags are named values: strings, numbers or booleans. Declare starting values on the game:

```ts
flags: { roof_unlocked: false, coins: 0, met: "nobody" },
```

| TypeScript | Ink | Does |
| --- | --- | --- |
| `world.flag("coins")` | `flag("coins")`, or a mirrored `VAR` | Read (`undefined` if never set) |
| `world.setFlag("coins", 3)` | `>>> set coins 3` or `~ coins = 3` | Write, and emit `flag` |
| `world.events.on("flag", fn)` | | React to changes |

### Ink VARs mirror flags

When the Ink story declares a global with a flag's name, `InkRunner` keeps the two in step in both directions:

```ink
VAR roof_unlocked = false

=== moth_talk ===
* [The planter's watered.]
    Moth: Go see the roof.
    ~ roof_unlocked = true
```

That's usually all you need. Writers set state in Ink, and hotspots, doors and code read it. Turn mirroring off with `new InkRunner(world, story, { syncFlags: false })`.

### What reads flags

- **Hotspots:** `when: (world) => world.flag("roof_unlocked") === true`
- **Doors:** `openWhen: "cellar_door_open"` (see [Doors](/docs/doors))
- **Ink:** `{ roof_unlocked: … - else: … }`
- **Your code:** renderer effects, music changes, achievements, via `world.events.on("flag", …)`

## Choosing between them

Use an **item** for anything the player carries and combines. Use a **flag** for everything else: facts about the world, progress, counters, who's been met. A common pattern is both: `>>> give can` plus `~ took_can = true`, so the can's hotspot can hide itself with `when` and the story can mention it later.
