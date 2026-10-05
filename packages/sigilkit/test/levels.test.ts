import { describe, expect, it } from "vitest";
import { defineGame, RoomLayout, World, type RoomDef } from "../src/core/index";

/*
 * An isometric tower:
 * - ground: a walled hall ('h', interior, seen only while inside) with a doorway at (3,4),
 *   and an annex ('a', revealed once entered) in the top-right corner
 * - upper (24 px): a walkway ring on top of the hall's walls, reached by stairs from (6,3)
 * - roof (48 px): the 2×2 roof over the hall, reached by a step from the walkway at (1,3)
 */
const tower: RoomDef = {
  id: "tower",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  //          x: 01234567
  walkmap: [
    /* y0 */ ".....#..",
    /* y1 */ ".####...",
    /* y2 */ ".#..#...",
    /* y3 */ ".#..#...",
    /* y4 */ ".##.#...",
    /* y5 */ "........",
    /* y6 */ "........",
    /* y7 */ "........",
  ],
  areamap: [
    "      aa",
    "      aa",
    "  hh    ",
    "  hh    ",
  ],
  levels: [
    {
      id: "upper",
      elevation: 24,
      walkmap: [
        "        ",
        " ....   ",
        " .  .   ",
        " .  .   ",
        " ....   ",
      ],
    },
    {
      id: "roof",
      elevation: 48,
      walkmap: ["        ", "        ", "  ..    ", "  ..    "],
    },
  ],
  stairs: [
    { to: "upper", steps: [{ x: 6, y: 3 }, { x: 5, y: 3 }], top: { x: 4, y: 3 } },
    { from: "upper", to: "roof", steps: [{ x: 1, y: 3 }], top: { x: 2, y: 3 } },
  ],
  areas: [
    { id: "hall", key: "h", name: "the hall", interior: true, reveal: "inside" },
    { id: "annex", key: "a", reveal: "once", onEnter: ({ world }) => world.setFlag("entered_annex", true) },
  ],
  entries: { start: { at: { x: 6, y: 7 } } },
  hotspots: [
    { id: "crate", name: "crate", shape: { rect: [0, 0, 4, 4] }, standAt: { x: 7, y: 1 }, verbs: {} },
    { id: "weathervane", name: "weathervane", shape: { rect: [0, 0, 4, 4] }, standAt: { x: 3, y: 2 }, level: "roof", verbs: {} },
  ],
};

const game = defineGame({
  title: "levels",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "tower",
  // 24 px tall: fits under the walkway (24 px up) that runs over the hall's doorway.
  actors: { hero: { name: "Hero", sprite: "hero", speed: 8, height: 24 } },
  rooms: { tower },
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

function startedWorld() {
  const world = new World(game, { autoAdvanceMs: 1 });
  world.start();
  return world;
}

describe("multi-level rooms", () => {
  it("raises stair steps evenly between levels", () => {
    const layout = new RoomLayout(tower);
    expect(layout.elevationAt("ground", 6, 3)).toBeCloseTo(8);
    expect(layout.elevationAt("ground", 5, 3)).toBeCloseTo(16);
    expect(layout.elevationAt("upper", 1, 3)).toBeCloseTo(36);
    expect(layout.elevationAt("upper", 1, 1)).toBe(24);
    expect(layout.walkable("ground", 6, 3)).toBe(true);
  });

  it("climbs three levels by pathfinding, and comes back down", async () => {
    const world = startedWorld();
    expect(await runUntilSettled(world, world.walk("hero", { x: 1, y: 1, level: "upper" }))).toBe(true);
    expect(world.levelOf("hero")).toBe("upper");
    expect(world.actorViews()[0]!.elevation).toBe(24);

    expect(await runUntilSettled(world, world.walk("hero", { x: 3, y: 2, level: "roof" }))).toBe(true);
    expect(world.levelOf("hero")).toBe("roof");

    expect(await runUntilSettled(world, world.walk("hero", { x: 0, y: 7, level: "ground" }))).toBe(true);
    expect(world.levelOf("hero")).toBe("ground");
    expect(world.actorViews()[0]!.elevation).toBe(0);
  });

  it("only changes level on the stairs: no hopping onto the landing from inside the hall", async () => {
    const world = startedWorld();
    await world.command("place hero 3 3");
    const visited: string[] = [];
    world.events.on("areaChanged", () => {});
    const pending = world.walk("hero", { x: 4, y: 2, level: "upper" });
    let lastVisit = "";
    for (let elapsed = 0; elapsed < 20_000; elapsed += 16) {
      world.update(16);
      await Promise.resolve();
      await Promise.resolve();
      const visit = `${world.levelOf("hero")}:${world.tileOf("hero").x},${world.tileOf("hero").y}`;
      if (visit !== lastVisit) visited.push((lastVisit = visit));
      if (visit === "upper:4,2") break;
    }
    expect(await pending).toBe(true);
    expect(visited).toContain("ground:3,4"); // out through the doorway
    // grid-engine reports a tile once the step onto it ends, so the last step itself may not
    // be sampled; what matters is that the climb onto the landing came from outside the hall.
    const tileBeforeLanding = visited[visited.indexOf("upper:4,3") - 1];
    expect(["ground:5,3", "ground:5,4", "ground:5,2", "ground:6,3", "ground:6,4", "ground:6,2"]).toContain(tileBeforeLanding);
  });

  it("rises smoothly during the level-changing step", async () => {
    const world = startedWorld();
    await world.command("place hero 5 3");
    const climbing = world.walk("hero", { x: 4, y: 3, level: "upper" });
    for (let microtask = 0; microtask < 10; microtask++) await Promise.resolve();
    world.update(60);
    const midway = world.actorViews()[0]!;
    expect(midway.moving).toBe(true);
    expect(midway.elevation).toBeGreaterThan(16);
    expect(midway.elevation).toBeLessThan(24);
    expect(await runUntilSettled(world, climbing)).toBe(true);
    expect(world.actorViews()[0]!.elevation).toBe(24);
  });

  it("climbs with the stick: pushing toward the landing from the last step", async () => {
    const world = startedWorld();
    await world.command("place hero 5 3");
    const landing = world.screenOf({ x: 4, y: 3 }, "upper");
    const lastStep = world.screenOf({ x: 5, y: 3 });
    const climbing = world.stepToward("hero", { x: landing.x - lastStep.x, y: landing.y - lastStep.y });
    expect(climbing).not.toBeNull();
    expect(await runUntilSettled(world, climbing!)).toBe(true);
    expect(world.levelOf("hero")).toBe("upper");
  });

  it("lets a newer walk cancel the rest of a multi-level route", async () => {
    const world = startedWorld();
    const firstRoute = world.walk("hero", { x: 3, y: 2, level: "roof" });
    world.update(100);
    const secondRoute = world.walk("hero", { x: 1, y: 6 });
    expect(await runUntilSettled(world, secondRoute)).toBe(true);
    expect(await firstRoute).toBe(false);
    for (let elapsed = 0; elapsed < 3000; elapsed += 16) world.update(16);
    expect(world.levelOf("hero")).toBe("ground");
    expect(world.tileOf("hero")).toEqual({ x: 1, y: 6 });
  });

  it("raises the actor's screen position and sort key with its floor", async () => {
    const world = startedWorld();
    await runUntilSettled(world, world.walk("hero", { x: 4, y: 1, level: "upper" }));
    const view = world.actorViews()[0]!;
    const floorPoint = world.projection.tileToScreen(4, 1);
    expect(view.screen.y).toBe(floorPoint.y - 24);
    expect(view.sortY).toBeGreaterThan(floorPoint.y);
    expect(view.sortY).toBeLessThan(world.projection.tileToScreen(5, 1).y);
  });

  it("keeps the current level for a walk without one, when the tile is walkable there", async () => {
    const world = startedWorld();
    await runUntilSettled(world, world.walk("hero", { x: 1, y: 1, level: "upper" }));
    expect(await runUntilSettled(world, world.walk("hero", { x: 4, y: 4 }))).toBe(true);
    expect(world.levelOf("hero")).toBe("upper");
  });

  it("takes a level argument in walk and place commands, and survives save and load", async () => {
    const world = startedWorld();
    await world.command("place hero 4 1 upper");
    expect(world.levelOf("hero")).toBe("upper");
    const saved = world.serialize();
    expect(saved.actors.hero!.level).toBe("upper");

    const restored = new World(game, { autoAdvanceMs: 1 });
    restored.load(saved);
    expect(restored.levelOf("hero")).toBe("upper");
    await runUntilSettled(restored, restored.command("walk hero 2 3 roof"));
    expect(restored.levelOf("hero")).toBe("roof");
  });

  it("picks the highest visible floor under the pointer", () => {
    const world = startedWorld();
    expect(world.pickTile(world.screenOf({ x: 2, y: 2 }, "roof"))).toEqual({ x: 2, y: 2, level: "roof" });
    expect(world.pickTile(world.screenOf({ x: 4, y: 1 }, "upper"))).toEqual({ x: 4, y: 1, level: "upper" });
    expect(world.pickTile(world.screenOf({ x: 6, y: 6 }))).toEqual({ x: 6, y: 6, level: "ground" });
    expect(world.pickTile(world.screenOf({ x: 5, y: 3 }, "ground"))).toEqual({ x: 5, y: 3, level: "ground" });
  });

  it("rejects stairs whose landing isn't walkable, or isn't next to the last step", () => {
    const landingInMidair: RoomDef = { ...tower, stairs: [{ to: "upper", steps: [{ x: 6, y: 1 }], top: { x: 5, y: 1 } }] };
    expect(() => new RoomLayout(landingInMidair)).toThrow(/must be walkable on "upper"/);
    const landingTooFar: RoomDef = { ...tower, stairs: [{ to: "upper", steps: [{ x: 7, y: 3 }], top: { x: 4, y: 3 } }] };
    expect(() => new RoomLayout(landingTooFar)).toThrow(/next to the last step/);
  });

  it("rejects areamap letters without an area", () => {
    expect(() => new RoomLayout({ ...tower, areamap: ["z"] })).toThrow(/no area with that key/);
  });
});

describe("areas", () => {
  it("reveals a reveal-once area for good on entering it, and runs its onEnter", async () => {
    const world = startedWorld();
    expect(world.isAreaRevealed("annex")).toBe(false);
    expect(world.hotspots().map((hotspot) => hotspot.id)).not.toContain("crate");

    const areaChanges: (string | null)[] = [];
    world.events.on("areaChanged", ({ area }) => areaChanges.push(area));
    await runUntilSettled(world, world.walk("hero", { x: 7, y: 1 }));
    expect(world.isAreaRevealed("annex")).toBe(true);
    expect(world.flag("entered_annex")).toBe(true);
    expect(world.hotspots().map((hotspot) => hotspot.id)).toContain("crate");

    await runUntilSettled(world, world.walk("hero", { x: 6, y: 7 }));
    expect(areaChanges).toEqual(["annex", null]);
    expect(world.isAreaRevealed("annex")).toBe(true);
    expect(world.serialize().revealed).toEqual(["tower:annex"]);
  });

  it("reveals by script, too", async () => {
    const world = startedWorld();
    await world.command("reveal annex");
    expect(world.isAreaRevealed("annex")).toBe(true);
  });

  it("shows a reveal-inside area only while the player is in it", async () => {
    const world = startedWorld();
    expect(world.isAreaRevealed("hall")).toBe(false);
    await runUntilSettled(world, world.walk("hero", { x: 3, y: 3 }));
    expect(world.areaOf()?.id).toBe("hall");
    expect(world.isAreaRevealed("hall")).toBe(true);
    await runUntilSettled(world, world.walk("hero", { x: 3, y: 6 }));
    expect(world.isAreaRevealed("hall")).toBe(false);
  });

  it("cuts away the front walls and everything above an interior while the player is inside", async () => {
    const world = startedWorld();
    expect(world.cutaway()).toBeNull();
    expect(world.isCutAway("roof", 2, 2)).toBe(false);

    await runUntilSettled(world, world.walk("hero", { x: 2, y: 2 }));
    expect(world.cutaway()?.id).toBe("hall");
    // Front walls (on screen, below and beside the hall) go; back walls stay.
    expect(world.isCutAway("ground", 4, 3)).toBe(true);
    expect(world.isCutAway("ground", 2, 4)).toBe(true);
    expect(world.isCutAway("ground", 4, 4)).toBe(true);
    expect(world.isCutAway("ground", 1, 1)).toBe(false);
    expect(world.isCutAway("ground", 2, 1)).toBe(false);
    // Everything above the hall and all of its walls goes, back walls included.
    expect(world.isCutAway("roof", 2, 2)).toBe(true);
    expect(world.isCutAway("upper", 4, 3)).toBe(true);
    expect(world.isCutAway("upper", 1, 1)).toBe(true);
    // The yard outside stays.
    expect(world.isCutAway("ground", 6, 6)).toBe(false);
    // Hotspots up there can't be used, and the pointer falls through to what's below.
    expect(world.hotspots().map((hotspot) => hotspot.id)).not.toContain("weathervane");
    expect(world.pickTile(world.screenOf({ x: 2, y: 2 }, "roof")).level).not.toBe("roof");

    await runUntilSettled(world, world.walk("hero", { x: 3, y: 6 }));
    expect(world.cutaway()).toBeNull();
    expect(world.isCutAway("roof", 2, 2)).toBe(false);
  });
});

describe("character height and clearance", () => {
  it("works out headroom from the levels above, and from explicit clearances", () => {
    const layout = new RoomLayout({ ...tower, clearances: [{ tiles: [{ x: 7, y: 7 }], height: 12 }] });
    expect(layout.clearanceAt("ground", 3, 4)).toBe(24); // the walkway over the doorway
    expect(layout.clearanceAt("ground", 2, 2)).toBe(48); // the roof over the hall
    expect(layout.clearanceAt("ground", 6, 6)).toBe(Infinity); // open sky
    expect(layout.clearanceAt("ground", 7, 7)).toBe(12); // a vent
    expect(layout.clearanceAt("upper", 1, 1)).toBe(Infinity);
  });

  it("keeps a two-block character out of a doorway one and a half blocks high", async () => {
    // No height given: two tile heights, 32 px. The doorway has 24 px.
    const tallGame = defineGame({ ...game, actors: { hero: { name: "Hero", sprite: "hero", speed: 8 } } });
    const world = new World(tallGame, { autoAdvanceMs: 1 });
    world.start();
    expect(world.heightOf("hero")).toBe(32);
    expect(world.fits("hero", { x: 3, y: 4 }, "ground")).toBe(false);
    expect(await runUntilSettled(world, world.walk("hero", { x: 2, y: 2 }))).toBe(false);
    expect(world.areaOf()).toBeNull(); // stopped outside
    // The stick won't push it under, either (it may slide along the wall instead).
    await world.command("place hero 3 5");
    const doorway = world.screenOf({ x: 3, y: 4 });
    const outside = world.screenOf({ x: 3, y: 5 });
    const step = world.stepToward("hero", { x: doorway.x - outside.x, y: doorway.y - outside.y });
    if (step) await runUntilSettled(world, step);
    expect(world.tileOf("hero")).not.toEqual({ x: 3, y: 4 });
  });

  it("lets a shorter character through, and routes around a low spot when there's another way", async () => {
    const world = startedWorld();
    expect(await runUntilSettled(world, world.walk("hero", { x: 2, y: 2 }))).toBe(true);

    const ventGame = defineGame({
      ...game,
      rooms: { tower: { ...tower, clearances: [{ tiles: [{ x: 6, y: 6 }], height: 12 }] } },
    });
    const ventWorld = new World(ventGame, { autoAdvanceMs: 1 });
    ventWorld.start();
    const visited = new Set<string>();
    const pending = ventWorld.walk("hero", { x: 6, y: 5 });
    for (let elapsed = 0; elapsed < 5000; elapsed += 16) {
      ventWorld.update(16);
      await Promise.resolve();
      await Promise.resolve();
      const tile = ventWorld.tileOf("hero");
      visited.add(`${tile.x},${tile.y}`);
    }
    expect(await pending).toBe(true);
    expect(visited.has("6,6")).toBe(false);
  });

  it("won't climb onto a landing that's too low", async () => {
    const lowLanding = defineGame({
      ...game,
      rooms: { tower: { ...tower, clearances: [{ level: "upper", tiles: [{ x: 4, y: 3 }], height: 10 }] } },
    });
    const world = new World(lowLanding, { autoAdvanceMs: 1 });
    world.start();
    expect(await runUntilSettled(world, world.walk("hero", { x: 1, y: 1, level: "upper" }))).toBe(false);
    expect(world.levelOf("hero")).toBe("ground");
  });
});

