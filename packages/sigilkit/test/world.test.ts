import { describe, expect, it } from "vitest";
import { defineGame, isometric, orthogonal, tokenize, World } from "../src/core/index";

const game = defineGame({
  title: "test",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "cabin",
  actors: {
    hero: { name: "Hero", sprite: "hero", speed: 8 },
    moth: { name: "Moth", sprite: "moth", verbs: { talk: async ({ world }) => world.say("moth", "hi") } },
  },
  items: { key: { name: "Key", icon: "key", with: { door: async ({ world }) => world.setFlag("door_open", true) } } },
  rooms: {
    cabin: {
      id: "cabin",
      projection: "orthogonal",
      tile: { width: 16, height: 16 },
      walkmap: ["......", ".##...", "......"],
      entries: { start: { at: { x: 0, y: 0 } } },
      actors: { moth: { at: { x: 5, y: 2 } } },
      hotspots: [
        {
          id: "door",
          name: "Door",
          shape: { rect: [80, 0, 16, 16] },
          standAt: { x: 4, y: 0 },
          verbs: { look: async ({ world }) => world.setFlag("looked", true), walk: async ({ world }) => world.goto("meadow") },
        },
      ],
    },
    meadow: {
      id: "meadow",
      projection: "isometric",
      tile: { width: 32, height: 16 },
      walkmap: ["....", "....", "...."],
      entries: { door: { at: { x: 1, y: 1 }, facing: "down" } },
      hotspots: [],
    },
  },
});

/** Step world time until a promise settles. */
async function run<T>(world: World, p: Promise<T>, maxMs = 10_000): Promise<T> {
  let done = false;
  let value!: T;
  void p.then((v) => {
    done = true;
    value = v;
  });
  for (let t = 0; t < maxMs && !done; t += 16) {
    world.update(16);
    await Promise.resolve();
    await Promise.resolve();
  }
  if (!done) throw new Error("timed out");
  return value;
}

describe("projection", () => {
  it("round-trips orthogonal tiles", () => {
    const p = orthogonal(16, 16, { x: 8, y: 4 });
    const s = p.tileToScreen(3, 2);
    expect(p.screenToTile(s.x, s.y)).toEqual({ x: 3, y: 2 });
  });

  it("round-trips isometric tiles across the grid", () => {
    const p = isometric(32, 16, { x: 100, y: 10 });
    for (let x = 0; x < 6; x++)
      for (let y = 0; y < 6; y++) {
        const s = p.tileToScreen(x, y);
        expect(p.screenToTile(s.x, s.y)).toEqual({ x, y });
      }
    expect(p.depth(2, 3)).toBeGreaterThan(p.depth(2, 2));
  });
});

describe("commands", () => {
  it("keeps quoted text together", () => {
    expect(tokenize('say moth "the door is stuck"')).toEqual(["say", "moth", "the door is stuck"]);
  });
});

describe("world", () => {
  it("pathfinds around blocked tiles", async () => {
    const w = new World(game);
    w.start();
    expect(await run(w, w.walk("hero", { x: 2, y: 2 }))).toBe(true);
    expect(w.tileOf("hero")).toEqual({ x: 2, y: 2 });
  });

  it("walks to a hotspot's stand point before running its verb", async () => {
    const w = new World(game);
    w.start();
    await run(w, w.activate({ x: 85, y: 5 }, "look"));
    expect(w.tileOf("hero")).toEqual({ x: 4, y: 0 });
    expect(w.flag("looked")).toBe(true);
  });

  it("falls back to a spoken line when a verb has no handler", async () => {
    const w = new World(game, { autoAdvanceMs: 100 });
    w.start();
    const lines: string[] = [];
    w.ui.subscribe(() => {
      const l = w.ui.get().line;
      if (l) lines.push(l.text);
    });
    await run(w, w.interact("door", "take"));
    expect(lines).toEqual(["I can't do that."]);
  });

  it("uses an inventory item on a hotspot", async () => {
    const w = new World(game);
    w.start();
    w.give("key");
    w.holdItem("key");
    await run(w, w.activate({ x: 85, y: 5 }));
    expect(w.flag("door_open")).toBe(true);
    expect(w.ui.get().heldItem).toBeNull();
  });

  it("changes rooms and switches projection", async () => {
    const w = new World(game);
    w.start();
    await run(w, w.command("goto meadow door"));
    expect(w.room.id).toBe("meadow");
    expect(w.projection.kind).toBe("isometric");
    expect(w.tileOf("hero")).toEqual({ x: 1, y: 1 });
    expect(w.actorsInRoom()).toEqual(["hero"]);
  });

  it("round-trips through serialize/load", async () => {
    const w = new World(game);
    w.start();
    await run(w, w.walk("hero", { x: 3, y: 2 }));
    w.give("key");
    const saved = JSON.parse(JSON.stringify(w.serialize()));
    const w2 = new World(game);
    w2.load(saved);
    expect(w2.tileOf("hero")).toEqual({ x: 3, y: 2 });
    expect(w2.has("key")).toBe(true);
  });

  it("produces smooth, depth-sorted actor views", () => {
    const w = new World(game);
    w.start();
    void w.walk("hero", { x: 1, y: 0 });
    w.update(60);
    const hero = w.actorViews().find((v) => v.id === "hero")!;
    expect(hero.moving).toBe(true);
    expect(hero.screen.x).toBeGreaterThan(8);
    expect(hero.screen.x).toBeLessThan(24);
    const depths = w.actorViews().map((v) => v.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });
});

describe("tileArea", () => {
  it("covers the tiles it names in both projections", async () => {
    const { pointInShape, projectionFor, tileArea } = await import("../src/core/index");
    for (const room of Object.values(game.rooms)) {
      const shape = tileArea(room, 1, 1, 2, 1, 8);
      const p = projectionFor(room);
      const inside = p.tileToScreen(2, 1);
      const outside = p.tileToScreen(0, 0);
      expect(pointInShape(shape, inside)).toBe(true);
      expect(pointInShape(shape, outside)).toBe(false);
      expect(pointInShape(shape, { x: inside.x, y: inside.y - 6 - room.tile.height / 2 })).toBe(true); // lifted part
    }
  });
});
