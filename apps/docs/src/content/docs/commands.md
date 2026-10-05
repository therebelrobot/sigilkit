# Commands

A command is one line of text that makes the world do something: `walk moth 4 5`, `goto rooftop hatch`, `wait 600`. Ink stories run them as `>>> ` lines, TypeScript runs them with `world.command(line)`, and every built-in also has a method.

```ink
=== moth_tour ===
>>> walk moth 4 5
>>> face moth up
Moth: The planter.
>>> wait 600
>>> goto rooftop hatch
```

```ts
await world.command("walk moth 4 5");
await world.command('say moth "The planter."'); // leading >>> is optional
```

## Built-ins

| Command | Method | Notes |
| --- | --- | --- |
| `walk <actor> <x> <y> [level]` | `walk(id, { x, y, level })` | Finishes on arrival, or when the walk stops short |
| `place <actor> <x> <y> [level]` | `place(id, { x, y, level })` | Instant |
| `face <actor> <facing>` | `face(id, facing)` | `up down left right up-left up-right down-left down-right` |
| `say <actor> "<text>"` | `say(id, text)` | `-` as the actor is narration. Finishes when the line is advanced |
| `wait <ms>` | `wait(ms)` | World time |
| `goto <room> [entry]` | `goto(room, entry)` | Runs the room's `onEnter` |
| `give <item>` / `take <item>` | `give(item)` / `take(item)` | Inventory |
| `set <flag> [value]` | `setFlag(name, value)` | Value defaults to `true`. `true`/`false`/numbers are parsed |
| `show <actor>` / `hide <actor>` | `setVisible(id, bool)` | |
| `music [key]` | | Emits `music`. No key means silence |
| `sfx <key>` | | Emits `sfx` |
| `reveal <area>` | `revealArea(id)` | Lifts a `reveal: "once"` area's fog |
| `block <x> <y> [level]` | `setWalkable(tile, false)` | Permanent, saved |
| `unblock <x> <y> [level]` | `setWalkable(tile, true)` | Permanent, saved |

## Syntax

- Arguments are separated by whitespace. Double quotes keep a phrase together, and `\"` escapes a quote inside one: `say moth "the \"door\" is stuck"`.
- `tokenize(line)` and `parseValue(raw)` are exported if you want the same parsing elsewhere.
- An unknown command throws `unknown command "…"`. Inside a handler that becomes an `error` event.

## Sequencing

When a command returns a promise, the caller waits for it. `InkRunner` awaits every `>>>` line, so a cutscene is lines in order: `walk` finishes when the actor arrives, `say` when the player clicks, `wait` when world time passes.

To do two things at once, write a command that starts something and returns without waiting:

```ts
world.commands.set("stroll", ([actor, x, y], w) => {
  void w.walk(actor!, { x: Number(x), y: Number(y) });
});
```

## Your own commands

`world.commands` is a `Map<string, CommandFn>`:

```ts
type CommandFn = (args: string[], world: World) => void | Promise<void>;

world.commands.set("shake", async ([ms = "300"], w) => {
  camera.shake();           // your renderer code
  await w.wait(Number(ms)); // the story waits for it
});
```

```ink
>>> shake 500
```

Good candidates: camera moves, screen effects, spawning actors, starting a minigame that resolves when won, analytics, anything a writer should be able to trigger. Commands are the main extension point between story and code.

## World time

`wait` counts world time, which the renderer advances each frame through `world.update(ms)`. It isn't `setTimeout`. Tests step time themselves, so a long cutscene finishes instantly and identically every run, and a multiplayer server's simulation doesn't depend on its machine's clock.
