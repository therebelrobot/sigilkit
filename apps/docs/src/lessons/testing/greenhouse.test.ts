import { World } from "sigilkit";
import { InkRunner } from "sigilkit/story";
import { game } from "../items/game";
import { describe, expect, it, story } from "./harness"; // in a project: from "vitest"

/** A fresh world with the story installed. Lines resolve themselves after 1 ms of world time. */
function newWorld(): World {
  const world = new World(game, { autoAdvanceMs: 1 });
  new InkRunner(world, story());
  world.start();
  return world;
}

/** Step world time, 16 ms at a time, until a promise settles. */
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
  if (!settled) throw new Error(`timed out after ${maximumMs} ms of world time`);
  return value;
}

describe("greenhouse", () => {
  it("can reach every hotspot's stand tile", async () => {
    for (const hotspot of game.rooms.greenhouse.hotspots) {
      if (!hotspot.standAt) continue;
      const world = newWorld();
      expect(await runUntilSettled(world, world.walk(world.player, hotspot.standAt)), hotspot.id).toBe(true);
    }
  });

  it("puts the can in the inventory and hides its hotspot", async () => {
    const world = newWorld();
    await runUntilSettled(world, world.interact("can", "take"));
    expect(world.state.inventory).toContain("can");
    expect(world.hotspots().some((hotspot) => hotspot.id === "can")).toBe(false);
  });

  it("waters the planter with the can", async () => {
    const world = newWorld();
    await runUntilSettled(world, world.interact("can", "take"));
    await runUntilSettled(world, world.interact("planter", "use", "can"));
    expect(world.flag("planter_watered")).toBe(true);
  });

  it("can't water the planter without the can", async () => {
    const world = newWorld();
    await runUntilSettled(world, world.interact("planter", "use"));
    expect(world.flag("planter_watered")).toBe(false);
  });

  it("survives a save and load", async () => {
    const world = newWorld();
    await runUntilSettled(world, world.interact("can", "take"));
    const saved = world.serialize();
    const restored = newWorld();
    restored.load(saved);
    expect(restored.has("can")).toBe(true);
    expect(restored.tileOf("wren")).toEqual(world.tileOf("wren"));
  });
});
