# Talking with Ink

Writing dialog as TypeScript strings works, but it isn't how writers want to work. sigilkit's story layer is [Ink](https://www.inklestudios.com/ink/), inkle's scripting language for branching narrative. You write `.ink` files (in any editor, or in inkle's Inky) and sigilkit runs their **knots** as handlers.

Click Moth, the teal robot, to talk. Pick a few questions and notice which ones disappear. Then open **story.ink**, change a line, and press **Run**.

## Knots are handlers

In [the last lesson](/learn/hotspots) handlers were functions. Now they're strings:

```ts
verbs: { look: "planter_look", use: "planter_use" },
```

A string handler is a story path. With an `InkRunner` installed, `"planter_look"` runs the knot `=== planter_look ===` to its `-> END`.

```ts
import { World } from "sigilkit";
import { InkRunner } from "sigilkit/story";
import story from "./story.ink"; // compiled by ink() from sigilkit/story/vite

const world = new World(game);
new InkRunner(world, story); // installs itself as the world's script runner
world.start();
```

## Lines

Inside a knot, every line of output becomes something on screen:

| Ink | On screen |
| --- | --- |
| `Moth: Back again?` | A line spoken by the actor whose id or name is "Moth", in their `color` |
| `A puff of dust.` | Narration, with no speaker |
| `* [Why the wings?]` | A choice in the choice list |
| `>>> walk moth 4 6` | An engine command, covered in [Commands](/learn/commands) |

A `Name:` prefix only counts as a speaker if it matches an actor. Anything else, like `Note: the door's open`, stays narration, so ordinary colons are safe.

Each line waits for the player to click (or press Enter, or A on a gamepad) before the story continues. The world stays busy for the whole knot.

## Choices

Ink's choices come through as the choice list:

- `*` choices are offered once. After you pick one, it's gone.
- `+` choices are sticky. Use them for "Bye" and other repeatable questions.
- `- (questions)` is a labelled gather, and `-> questions` loops back to it, which is how a conversation keeps offering what's left.

`{ moth_talk == 1: … - else: … }` uses Ink's visit count: a knot's name is the number of times it has run. That's how Moth greets you differently the second time.

## Actors have verbs too

Moth isn't a hotspot. Moth is an **actor** placed in the room through `actors` on `RoomDef`, and verbs on an `ActorDef` work the same way as hotspot verbs. Clicking an actor uses `talk` unless you've picked another verb. The player walks up beside them, and the two face each other.

> [!TIP]
> Try it: give Moth another question, or have Moth answer "Who are you?" differently the third time (`{ moth_talk >= 3: … }`). Break the syntax on purpose too, to see how compile errors are reported.

## Compiling Ink

These lessons compile Ink in your browser so you can edit it. In a real game, compile at build time with the Vite plugin, which reports errors in the dev overlay:

```ts
// vite.config.ts
import { ink } from "sigilkit/story/vite";
export default defineConfig({ plugins: [react(), ink()] });
```

## What you learned

- `InkRunner` turns knots into handlers: a verb string names a knot.
- `Name: text` is speech, other lines are narration, `*` and `+` are choices.
- Actors are clickable through `ActorDef.verbs`, and `talk` is their default verb.
