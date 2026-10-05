# Items and inventory

Adventure games run on "use this with that". In this lesson Wren picks up a watering can and uses it on the planter, and on Moth, who isn't keen.

Click the watering can on the bench to take it. It appears in the inventory bar under the verbs. Click it there to hold it, and the sentence line reads "Use watering can with…". Then click the planter. Watch the **inventory** and **flags** in the inspector change as you go.

## Defining items

Items are declared once on the game, by id:

```ts
items: {
  can: {
    name: "watering can",
    icon: "can",
    with: { planter: "planter_water", moth: "moth_water" },
  },
},
```

`with` maps a **target id** to a handler. The target can be a hotspot (`planter`) or an actor (`moth`). The handler is an Ink knot or a function, as usual.

## Giving and taking

The inventory is a list of item ids in the world's state:

| Ink | TypeScript | Does |
| --- | --- | --- |
| `>>> give can` | `world.give("can")` | Add to the inventory (once) |
| `>>> take can` | `world.take("can")` | Remove it |
| `{ has_item("can"): … }` | `world.has("can")` | Check for it |

`has_item` is one of the functions `InkRunner` provides. Declare it with `EXTERNAL has_item(id)` so the Ink compiler knows it exists. The others are `flag(name)`, `target()`, `verb()` and `held_item()`.

## Using one thing with another

When the player holds an item and clicks a target, the world looks up `items[held].with[target]`:

- If it's there, that handler runs, and the item is put away afterwards.
- If not, the target's own `use` verb runs. The planter's `planter_use` says "I need something to water it with", which works in both cases.
- If neither exists, the player says the fallback line.

Clicking the floor while holding an item puts it away, and so does pressing Escape or B in [couch controls](/learn/input).

## Removing what's been taken

The can is a hotspot on the bench, so after taking it the hotspot has to go too. That's `when`:

```ts
when: (world) => !world.flag("took_can"),
```

The `can_take` knot sets `took_can`, the hotspot's `when` reads it, and the can disappears. The next lesson looks at flags properly.

## What you learned

- `game.items` declares items, and `with` says what happens when one is used on a target.
- `give`, `take` and `has_item` change and check the inventory, from Ink or from TypeScript.
- The held item's `with` handler wins, then the target's `use`, then the fallback.
