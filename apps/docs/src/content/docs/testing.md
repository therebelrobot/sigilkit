# Testing headlessly

The `World` has no DOM, no renderer and no wall clock. A whole scene can run in a unit test: walk somewhere, use something, answer a question, and assert on what changed. Rooms are data, so tests find the bugs that data invites, like a hotspot nobody can reach or a puzzle that can't be finished, before a player does.

The [Testing headlessly](/learn/testing) lesson runs a suite like this in your browser.

## The setup

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { World } from "sigilkit";
import { InkRunner } from "sigilkit/story";
import { compileInk } from "sigilkit/story/vite";
import { game } from "../src/game";

const story = compileInk(readFileSync("src/story/main.ink", "utf8"), "src/story/main.ink");

function newWorld(): World {
  const world = new World(game, { autoAdvanceMs: 1 }); // lines answer themselves
  new InkRunner(world, story);
  world.start();
  return world;
}

/** Step world time 16 ms at a time until a promise settles. */
async function runUntilSettled<T>(world: World, pending: Promise<T>, maximumMs = 30_000): Promise<T> {
  let settled = false;
  let value!: T;
  void pending.then((result) => {
    settled = true;
    value = result;
  });
  for (let elapsedMs = 0; elapsedMs < maximumMs && !settled; elapsedMs += 16) {
    world.update(16);
    await Promise.resolve();
    await Promise.resolve();
  }
  if (!settled) throw new Error("timed out");
  return value;
}
```

Three things make it work:

- **`autoAdvanceMs`** resolves every `say` line after that much world time, so dialog doesn't wait for a click. Choices still wait: answer them with `world.choose(index)` when `world.ui.get().choices` is non-empty.
- **`world.update(ms)`** is the only clock. Nothing moves unless the test advances it, so a long cutscene runs in microseconds and identically every time.
- **`runUntilSettled`** turns walks, interactions and room changes into awaitable steps.

## Reachability

The most common room bug is a route that's cut off by a furniture letter, a missing doorway or a low arch. Test every `standAt` for every character who needs it:

```ts
it("can reach every hotspot", async () => {
  for (const room of Object.values(game.rooms)) {
    for (const hotspot of room.hotspots) {
      if (!hotspot.standAt) continue;
      const world = newWorld();
      await runUntilSettled(world, world.goto(room.id));
      const target = { ...hotspot.standAt, ...(hotspot.level ? { level: hotspot.level } : {}) };
      expect(await runUntilSettled(world, world.walk(world.player, target)), `${room.id}/${hotspot.id}`).toBe(true);
    }
  }
});
```

## Puzzles

Drive the steps with `world.interact(target, verb, item?)` (the same path a click takes, minus picking) and assert on state:

```ts
it("waters the planter", async () => {
  const world = newWorld();
  await runUntilSettled(world, world.interact("can", "take"));
  expect(world.has("can")).toBe(true);
  await runUntilSettled(world, world.interact("planter", "use", "can"));
  expect(world.flag("planter_watered")).toBe(true);
});
```

## Conversations

```ts
it("unlocks the roof by talking to Moth", async () => {
  const world = newWorld();
  world.setFlag("planter_watered", true);
  const talking = world.interact("moth", "talk");
  await runUntilSettled(world, new Promise<void>((resolve) => {
    const stop = world.ui.subscribe(() => world.ui.get().choices.length && (stop(), resolve()));
  }));
  const choice = world.ui.get().choices.find((c) => c.text.includes("watered"))!;
  world.choose(choice.index);
  // …answer "Bye." the same way, then:
  await runUntilSettled(world, talking);
  expect(world.flag("roof_unlocked")).toBe(true);
});
```

## Levels, areas and doors

Everything spatial is queryable: `world.levelOf(id)`, `world.areaOf()`, `world.cutaway()`, `world.isCutAway(level, x, y)`, `world.isAreaRevealed(id)`, `world.isDoorOpen(id)`, `world.fits(id, tile, level)` and `world.layout.walkable(level, x, y)`. [Designing a room](/docs/level-design#9-test-it-headlessly) has more examples.

## Input

Gamepad logic runs on `PadSnapshot` objects, so `new GamepadController(world).frame(snapshot, 16)` tests stick walking, focus and button handling with no Gamepad API. `Navigator` can be driven directly too.

## Saves

```ts
it("round-trips a save", async () => {
  const world = newWorld();
  await runUntilSettled(world, world.interact("can", "take"));
  const restored = newWorld();
  restored.load(world.serialize());
  expect(restored.has("can")).toBe(true);
});
```

## The server

The multiplayer `RoomServer` runs the same `World` with `spawnPlayer: false`, so anything you test here is what the server will do.
