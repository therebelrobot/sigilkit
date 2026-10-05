# Story with Ink

`sigilkit/story` runs [Ink](https://www.inklestudios.com/ink/) stories as the world's script runner. Writers work in `.ink` files (in Inky or any editor), and every knot can be a hotspot verb, an actor verb, an item combination or a room's `onEnter`.

```ts
import { InkRunner } from "sigilkit/story";
import story from "./story/main.ink"; // compiled by ink() from sigilkit/story/vite

const world = new World(game);
new InkRunner(world, story);
world.start();
```

Needs the `inkjs` peer.

## Knots are handlers

A string handler is a path: `verbs: { look: "planter_look" }` runs `=== planter_look ===` until it ends. Stitches work too (`"planter.look"`).

## Conventions

| In Ink | Becomes |
| --- | --- |
| `Moth: hello` | A line spoken by the actor whose id or name is "Moth" (case-insensitive) |
| `A cold wind.` | Narration (speaker `null`) |
| `Note: the door's open` | Narration too, because "Note" isn't an actor |
| `>>> walk wren 4 6` | An engine [command](/docs/commands), awaited |
| `* [choice]`, `+ [sticky]` | Choices in the UI. The knot waits for `choose()` |
| `VAR door_open = false` | Mirrored with the world flag `door_open`, both ways |
| `# mood:worried` | Tags, passed through on the `DialogLine` (`line.tags`) |

Each line waits for the player to advance it before the next one runs. The world is busy for the whole knot.

## Externals

`InkRunner` binds these functions. Declare the ones you use so the compiler knows them:

```ink
EXTERNAL has_item(id)
EXTERNAL flag(name)
EXTERNAL target()
EXTERNAL verb()
EXTERNAL held_item()
```

| Function | Returns |
| --- | --- |
| `has_item(id)` | Whether the item is in the inventory |
| `flag(name)` | A flag's value (`false` if unset), for flags without a mirrored VAR |
| `target()` | Id of the hotspot or actor being acted on |
| `verb()` | The verb being used |
| `held_item()` | The item used, in "use X with Y" handlers |

`target()` and `verb()` let one knot serve many hotspots: `verbs: { look: "generic_look" }` everywhere, then branch inside.

Add your own with `runner.story.BindExternalFunction(name, fn)`. `runner.story` is the inkjs `Story`.

## Options

```ts
new InkRunner(world, story, {
  commandPrefix: ">>>",        // lines starting with this run as commands
  syncFlags: true,             // mirror Ink globals <-> world flags
  resolveSpeaker: (name) => …, // map "Name:" to an actor id; return null for narration
});
```

## Visit counts

Every knot's name is the number of times it has run. That's the idiom for first-time lines:

```ink
=== shed_enter ===
{ shed_enter == 1:
    Wren: So this is where Moth hides.
}
-> END
```

Visit counts are part of Ink's state, so they're saved with the game.

## Compiling

**Vite:** `ink()` from `sigilkit/story/vite` compiles `.ink` imports at build time, reports errors in the dev overlay, and resolves and watches `INCLUDE`d files.

**Anything else:** `compileInk(source, file?)` from `sigilkit/story/vite` is plain Node and returns the JSON string. Or export JSON from Inky or inklecate and pass it to `InkRunner`, as a string or a parsed object.

## Saving

`InkRunner.save()` returns Ink's state JSON, and `world.serialize()` stores it as `script`. `world.load(state)` hands it back. You don't need to call these yourself.

## Other script runners

`InkRunner` implements `ScriptRunner`:

```ts
interface ScriptRunner {
  run(path: string, ctx: ScriptContext): Promise<void>;
  save?(): string;
  load?(blob: string): void;
}
```

Install anything with that shape through `world.useScriptRunner(runner)`. Or skip the story layer and use TypeScript handlers everywhere.

## Writing tips

- Write `look` for everything first. It's the cheapest way to make a room feel inhabited.
- Keep choreography in Ink (`>>> walk`, `>>> face`) and mechanics in code (custom commands).
- One `.ink` file per area of the game, joined with `INCLUDE`, keeps merges painless.
- inkle's [Writing with Ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) covers the language itself.
