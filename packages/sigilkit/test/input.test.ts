import { describe, expect, it } from "vitest";
import { defineGame, World } from "../src/core/index";
import { GamepadController, type PadSnapshot } from "../src/input/index";

const game = defineGame({
  title: "t",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "r",
  actors: { hero: { name: "Hero", sprite: "hero", speed: 10 } },
  rooms: {
    r: {
      id: "r",
      projection: "isometric",
      directions: 8,
      tile: { width: 32, height: 16 },
      walkmap: [".....", ".....", ".....", ".....", "....."],
      entries: { mid: { at: { x: 2, y: 2 } } },
      hotspots: [
        { id: "near", name: "lamp", shape: { rect: [140, 30, 20, 20] }, standAt: { x: 2, y: 1 }, verbs: { look: async ({ world }) => world.setFlag("looked", true) } },
        { id: "far", name: "door", shape: { rect: [0, 0, 4, 4] }, standAt: { x: 0, y: 4 }, verbs: {} },
      ],
    },
  },
});

const pad = (buttons: PadSnapshot["buttons"] = {}, axes = [0, 0, 0, 0]): PadSnapshot => ({ id: "test", buttons, axes });

async function frames(world: World, ctl: GamepadController, snap: PadSnapshot, n: number) {
  for (let i = 0; i < n; i++) {
    world.update(16);
    ctl.frame(snap, 16);
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe("GamepadController", () => {
  it("walks with the stick in screen space and auto-focuses the nearest target", async () => {
    const w = new World(game);
    w.start();
    const ctl = new GamepadController(w);
    await frames(w, ctl, pad({}, [0, -1, 0, 0]), 8);
    expect(w.tileOf("hero")).toEqual({ x: 1, y: 1 });
    await frames(w, ctl, pad(), 2);
    expect(w.ui.get().focus).toBe("near");
  });

  it("A acts on focus, X looks, and game hooks can consume buttons", async () => {
    const w = new World(game);
    w.start();
    const seen: string[] = [];
    const ctl = new GamepadController(w, {
      onButton: (e) => {
        if (e.button === "lt") {
          seen.push(`lt:${e.pressed}`);
          return true;
        }
      },
    });
    await frames(w, ctl, pad(), 1);
    await frames(w, ctl, pad({ x: 1 }), 1);
    await frames(w, ctl, pad(), 120);
    expect(w.flag("looked")).toBe(true);
    await frames(w, ctl, pad({ lt: 1 }), 1);
    await frames(w, ctl, pad(), 1);
    expect(seen).toEqual(["lt:true", "lt:false"]);
  });

  it("navigates and confirms choices", async () => {
    const w = new World(game);
    w.start();
    const ctl = new GamepadController(w);
    const picked = w.ask([{ index: 0, text: "a" }, { index: 1, text: "b" }]);
    await frames(w, ctl, pad({ down: 1 }), 1);
    await frames(w, ctl, pad(), 1);
    await frames(w, ctl, pad({ a: 1 }), 1);
    expect(await picked).toBe(1);
  });
});
