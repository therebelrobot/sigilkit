# Testing headlessly

The `World` has no DOM, no renderer and no wall clock, so a whole scene can run in a test: walk somewhere, use something, and check what changed. Rooms are data, so that's how you find out a hotspot can't be reached, before a player does.

Press **Run the tests**. Five tests play the greenhouse from [Items](/learn/items): taking the can, watering the planter, saving and loading. Then open **story.ink**, break the puzzle (delete `~ planter_watered = true` from `planter_water`), press **Run**, and run the tests again.

## Three things make it work

**A world without a screen.** `new World(game)` needs nothing else. Install the story the same way as in the game:

```ts
const world = new World(game, { autoAdvanceMs: 1 });
new InkRunner(world, story);
world.start();
```

**Lines that answer themselves.** In a game, `say` waits for the player to click. `autoAdvanceMs: 1` advances every line after 1 ms of world time. Choices still wait for `world.choose(index)`, so a test of a conversation picks its answers.

**Time you control.** Nothing moves until `world.update(ms)` is called. `runUntilSettled` steps the world 16 ms at a time until a promise (a walk, an interaction, a `goto`) settles, so a 20-second cutscene runs in milliseconds and the same way every time. The time next to each result above is real time.

## What to test

- **Reachability.** Every `standAt` should be reachable by every character who needs it. This catches the commonest level-design bug: a furniture letter or a low arch that cuts a room in half.
- **Puzzles.** Drive the steps with `world.interact(target, verb, item)` and assert on `world.flag(…)`, `world.has(…)` and `world.hotspots()`.
- **Multi-level rooms.** `world.levelOf`, `world.areaOf`, `world.isCutAway` and `world.isAreaRevealed` are all queryable. [Designing a room](/docs/level-design) has examples.
- **Saves.** A round trip through `serialize` and `load` should keep what matters.

## In your project

Use Vitest (or any runner). Compile the story with `compileInk` from `sigilkit/story/vite`, which works in Node:

```ts
import { readFileSync } from "node:fs";
import { compileInk } from "sigilkit/story/vite";

const story = compileInk(readFileSync("src/story/main.ink", "utf8"), "src/story/main.ink");
```

Then the test file looks exactly like **greenhouse.test.ts**, with `from "vitest"` in place of `from "./harness"`. The same `World` runs on the multiplayer server, so tests also cover what the server will do.

## What you learned

- The World runs anywhere. `autoAdvanceMs` answers lines, and `world.update` drives time.
- `runUntilSettled` turns any walk or interaction into an awaitable step in a test.
- Test reachability and puzzles in code. A broken route shows up as a failed test.
