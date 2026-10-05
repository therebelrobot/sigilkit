# Commands and cutscenes

Dialog says things, and commands make things happen. A **command** is one line of text, such as `walk moth 4 5` or `wait 600`, that the world runs. Ink stories use them with a `>>>` prefix. A cutscene is just a knot with several of them in a row.

Talk to Moth for the tour. Then type your own commands into the prompt under the demo, or click an example.

## Built-in commands

| Command | Does |
| --- | --- |
| `walk <actor> <x> <y> [level]` | Pathfind to a tile; finishes on arrival |
| `place <actor> <x> <y> [level]` | Put an actor on a tile instantly |
| `face <actor> <direction>` | `up`, `down`, `left`, `right`, or a diagonal like `up-left` |
| `say <actor> "<text>"` | A spoken line. Use `-` as the actor for narration |
| `wait <ms>` | Pause, in world time |
| `goto <room> [entry]` | Change room |
| `give <item>` / `take <item>` | Change the inventory |
| `set <flag> [value]` | Set a flag (`true` if no value) |
| `show <actor>` / `hide <actor>` | Change visibility |
| `music <key>` / `sfx <key>` | Ask the audio layer for music or a sound |
| `reveal <area>` | Lift an area's fog. See [Interiors and fog](/learn/areas) |
| `block <x> <y> [level]` / `unblock …` | Change a tile's walkability. See [Doors](/learn/doors) |

Arguments are separated by spaces. Double quotes keep a phrase together: `say moth "Mind the seedlings."`. Values like `true`, `false` and `42` are parsed to booleans and numbers where a command expects them.

## Sequencing is the point

Ink runs one line at a time. When a line is a command, `InkRunner` **awaits** it. `>>> walk moth 4 5` doesn't finish until Moth arrives, so the next line ("The planter…") is spoken in the right place. Choreography is just lines in order.

Sometimes you want two things at once: Wren drifting over while Moth starts the tour. That's the custom `stroll` command, which starts a walk and returns immediately, so the story moves on while Wren walks.

## Your own commands

`world.commands` is a plain `Map` from name to function:

```ts
world.commands.set("blink", async ([actor, times = "3"], w) => {
  for (let flicker = 0; flicker < Number(times); flicker++) {
    w.setVisible(actor!, false);
    await w.wait(120);
    w.setVisible(actor!, true);
    await w.wait(120);
  }
});
```

A command receives its arguments as strings and the world. If it returns a promise, the story waits for it. Use this for anything your game needs: camera moves, screen shakes, spell effects, a minigame that resolves when it's won.

## World time

`wait` and `w.wait(ms)` count **world time**: the clock the renderer advances every frame through `world.update(ms)`. It isn't `setTimeout`. In a test you call `world.update` yourself and a ten-second cutscene finishes instantly. On a server, time stays deterministic.

## From TypeScript

Every command is also a method, and any command line can be run from code:

```ts
await world.walk("moth", { x: 4, y: 5 });
world.face("moth", "up");
await world.command('say moth "The planter."');
```

## What you learned

- `>>> command` lines run engine commands, and each one finishes before the next line.
- `world.commands.set(name, fn)` adds your own, and async commands are awaited.
- `wait` uses world time, so cutscenes are testable and deterministic.
