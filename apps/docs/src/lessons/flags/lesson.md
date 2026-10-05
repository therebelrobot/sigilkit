# Flags and conditions

A story needs memory: has the door been opened, is the power on, how many times has the player flipped the switch. In sigilkit that memory is **flags**, a flat set of named values in the world's state that Ink, TypeScript and hotspot conditions all read.

The greenhouse is dark. Use the breaker switch by the skylight. The lamps come on, a sprout appears on the shelf, and Moth has something new to say. Then press the `world.setFlag` button under the demo, which flips the same flag from TypeScript, and the story keeps up.

## Declaring flags

Starting values go on the game:

```ts
flags: { power: false, switch_flips: 0 },
```

A flag is a string, a number or a boolean. Flags that aren't declared still work: `world.flag("anything")` is `undefined` until something sets it. Declaring them is mostly for readability, and so that Ink's VARs start with the right value.

## Ink VARs are flags

When an Ink story declares a global with the same name as a flag, `InkRunner` keeps the two in sync:

```ink
VAR power = false

=== breaker_use ===
~ power = not power
```

`~ power = not power` changes the Ink variable, which sets the world's flag, which emits a `flag` event. In the other direction, `world.setFlag("power", true)` updates the Ink variable, so conditions like `{ power: … }` see it straight away. Watch the **Events** tab in the inspector while you flip the switch.

A third way to set a flag, from a command line, works with no VAR at all:

```ink
>>> set power true
```

## Conditions everywhere

Once state lives in flags, everything can read it:

| Where | How |
| --- | --- |
| Ink text | `{ power: lit\|dark }` or a `{ power: … - else: … }` block |
| Hotspots | `when: (world) => world.flag("power") === true` |
| Doors | `openWhen: "cellar_door_open"`. See [Doors](/learn/doors) |
| TypeScript | `world.flag("power")`, and `world.events.on("flag", …)` to react |

The shelf in this room is two hotspots on the same tiles, with opposite `when` conditions: a dark shelf and a glowing sprout. That's often simpler than one hotspot whose handlers branch.

## Reacting to flags in code

**lights.ts** dims the whole frame while the power is off. It listens for the `flag` event and changes the alpha of a rectangle on `renderer.layers.overlay`. [Props and layers](/learn/props-and-layers) covers layers in more detail. What matters here is that a flag is the single source of truth, and Ink, hotspots and rendering all follow it.

## What you learned

- Flags are the story's memory: plain values in `world.state.flags`.
- An Ink VAR with a flag's name mirrors it both ways. `>>> set` and `world.setFlag` set flags from commands and code.
- `when`, Ink conditionals, doors and your own code all read the same flags.
