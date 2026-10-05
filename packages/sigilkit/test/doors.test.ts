import { describe, expect, it } from "vitest";
import { defineGame, RoomLayout, World, type RoomDef } from "../src/core/index";

/*
 * Two corridors joined by a wall with two gaps: a door at (2,1) and an open arch at (5,1).
 *
 *   y0  ......
 *   y1  ##D##.     D: the cellar door
 *   y2  ......
 */
const cellar: RoomDef = {
  id: "cellar",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: ["......", "##.##.", "......"],
  doors: [{ id: "cellar-door", tiles: [{ x: 2, y: 1 }], openWhen: "cellar_door_open" }],
  entries: { start: { at: { x: 2, y: 0 } } },
  hotspots: [],
};

const game = defineGame({
  title: "doors",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "cellar",
  actors: { hero: { name: "Hero", sprite: "hero", speed: 8 } },
  rooms: { cellar },
  flags: { cellar_door_open: false },
});

async function runUntilSettled<T>(world: World, pending: Promise<T>, maximumMilliseconds = 20_000): Promise<T> {
  let settled = false;
  let settledValue!: T;
  void pending.then((value) => {
    settled = true;
    settledValue = value;
  });
  for (let elapsed = 0; elapsed < maximumMilliseconds && !settled; elapsed += 16) {
    world.update(16);
    await Promise.resolve();
    await Promise.resolve();
  }
  if (!settled) throw new Error("timed out");
  return settledValue;
}

/** Walk while recording every tile passed through. */
async function walkTracing(world: World, to: { x: number; y: number }) {
  const visited = new Set<string>();
  const pending = world.walk("hero", to);
  let settled = false;
  let arrived = false;
  void pending.then((value) => {
    settled = true;
    arrived = value;
  });
  for (let elapsed = 0; elapsed < 20_000 && !settled; elapsed += 16) {
    world.update(16);
    await Promise.resolve();
    await Promise.resolve();
    const tile = world.tileOf("hero");
    visited.add(`${tile.x},${tile.y}`);
  }
  return { arrived, visited };
}

function startedWorld(roomOverrides: Partial<RoomDef> = {}) {
  const world = new World(defineGame({ ...game, rooms: { cellar: { ...cellar, ...roomOverrides } } }), { autoAdvanceMs: 1 });
  world.start();
  return world;
}

describe("doors", () => {
  it("are shut until their flag is set, and paths go around them", async () => {
    const world = startedWorld();
    expect(world.isDoorOpen("cellar-door")).toBe(false);
    expect(world.layout.walkable("ground", 2, 1)).toBe(false);
    const { arrived, visited } = await walkTracing(world, { x: 2, y: 2 });
    expect(arrived).toBe(true);
    expect(visited.has("2,1")).toBe(false);
    expect(visited.has("5,1")).toBe(true);
  });

  it("open when the flag is set, from Ink or code", async () => {
    const world = startedWorld();
    const changes: number[] = [];
    world.events.on("walkableChanged", ({ tiles }) => changes.push(tiles.length));
    await world.command("set cellar_door_open true");
    expect(world.isDoorOpen("cellar-door")).toBe(true);
    expect(changes).toEqual([1]);
    const { arrived, visited } = await walkTracing(world, { x: 2, y: 2 });
    expect(arrived).toBe(true);
    expect(visited.has("2,1")).toBe(true);
  });

  it("can follow a function instead of a flag", async () => {
    const world = startedWorld({ doors: [{ id: "cellar-door", tiles: [{ x: 2, y: 1 }], openWhen: (w) => w.has("key") }] });
    expect(world.isDoorOpen("cellar-door")).toBe(false);
    world.give("key");
    world.update(16);
    expect(world.layout.walkable("ground", 2, 1)).toBe(true);
  });

  it("re-plans a walk in progress when a door shuts in front of it, keeping the same promise", async () => {
    const world = startedWorld();
    world.setFlag("cellar_door_open", true);
    await world.command("place hero 0 0");
    const visited = new Set<string>();
    const pending = world.walk("hero", { x: 2, y: 2 });
    let arrived: boolean | undefined;
    void pending.then((value) => (arrived = value));
    world.update(16);
    await Promise.resolve();
    world.setFlag("cellar_door_open", false); // slams shut before the hero gets there
    for (let elapsed = 0; elapsed < 20_000 && arrived === undefined; elapsed += 16) {
      world.update(16);
      await Promise.resolve();
      await Promise.resolve();
      const tile = world.tileOf("hero");
      visited.add(`${tile.x},${tile.y}`);
    }
    expect(arrived).toBe(true);
    expect(visited.has("2,1")).toBe(false);
    expect(world.tileOf("hero")).toEqual({ x: 2, y: 2 });
  });

  it("must be on walkable tiles", () => {
    expect(() => new RoomLayout({ ...cellar, doors: [{ id: "bad", tiles: [{ x: 0, y: 1 }], openWhen: "x" }] })).toThrow(/must be '\.'/);
  });
});

describe("setWalkable", () => {
  it("blocks and unblocks tiles, and a walk fails when nothing's left", async () => {
    const world = startedWorld();
    await world.command("block 5 1");
    expect(world.layout.walkable("ground", 5, 1)).toBe(false);
    expect(await runUntilSettled(world, world.walk("hero", { x: 2, y: 2 }))).toBe(false);
    await world.command("unblock 5 1");
    expect(await runUntilSettled(world, world.walk("hero", { x: 2, y: 2 }))).toBe(true);
  });

  it("can open a wall that was never a door", async () => {
    const world = startedWorld();
    world.setWalkable({ x: 0, y: 1 }, true); // knock through
    await world.command("place hero 0 0");
    const { arrived, visited } = await walkTracing(world, { x: 0, y: 2 });
    expect(arrived).toBe(true);
    expect(visited.has("0,1")).toBe(true);
  });

  it("wins over a door, goes back with null, and is saved", async () => {
    const world = startedWorld();
    world.setFlag("cellar_door_open", true);
    world.setWalkable({ x: 2, y: 1 }, false); // rubble in the doorway
    expect(world.layout.walkable("ground", 2, 1)).toBe(false);

    const saved = world.serialize();
    expect(saved.walkable).toEqual({ "cellar:ground:2,1": false });
    const restored = new World(game, { autoAdvanceMs: 1 });
    restored.load(saved);
    expect(restored.layout.walkable("ground", 2, 1)).toBe(false);

    world.setWalkable({ x: 2, y: 1 }, null); // cleared: the open door decides again
    expect(world.layout.walkable("ground", 2, 1)).toBe(true);
    world.setFlag("cellar_door_open", false);
    expect(world.layout.walkable("ground", 2, 1)).toBe(false);
  });

  it("changes a room the player isn't in, ready for when they arrive", async () => {
    const twoRooms = defineGame({
      ...game,
      rooms: { cellar, attic: { ...cellar, id: "attic", doors: [] } },
    });
    const world = new World(twoRooms, { autoAdvanceMs: 1 });
    world.start();
    world.setWalkable({ x: 5, y: 1 }, false, "attic");
    expect(world.layout.walkable("ground", 5, 1)).toBe(true); // still in the cellar
    await runUntilSettled(world, world.goto("attic"));
    expect(world.layout.walkable("ground", 5, 1)).toBe(false);
  });
});
