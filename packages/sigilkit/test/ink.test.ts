import { defineGame, World } from "../src/core/index";
import { describe, expect, it } from "vitest";
import { InkRunner } from "../src/story/index";
import { compileInk } from "../src/story/vite";

const source = `
VAR door_open = false
EXTERNAL has_item(id)

=== look_lamp ===
Moth: The lamp's been out for days.
>>> walk hero 2 0
{has_item("oil"): Hero: I could fill it.|Hero: I've got nothing to fill it with.}
-> END

=== talk_moth ===
Moth: Well?
* [Ask about the lamp] Moth: It used to be brighter. # mood:wistful
* [Open the door]
  ~ door_open = true
  Hero: Done.
- -> END
`;

const game = defineGame({
  title: "t",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "r",
  actors: { hero: { name: "Hero", sprite: "hero", speed: 8 }, moth: { name: "Moth", sprite: "moth" } },
  rooms: {
    r: {
      id: "r",
      projection: "orthogonal",
      tile: { width: 16, height: 16 },
      walkmap: ["...."],
      actors: { moth: { at: { x: 3, y: 0 } } },
      hotspots: [],
    },
  },
});

async function drive(world: World, p: Promise<void>, onTick: () => void = () => {}) {
  let done = false;
  void p.then(() => (done = true));
  for (let i = 0; i < 2000 && !done; i++) {
    world.update(16);
    onTick();
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!done) throw new Error("timed out");
}

describe("InkRunner", () => {
  it("speaks lines, runs commands and reads externals", async () => {
    const w = new World(game, { autoAdvanceMs: 10 });
    w.start();
    new InkRunner(w, compileInk(source));
    const said: string[] = [];
    w.ui.subscribe(() => {
      const l = w.ui.get().line;
      if (l && said.at(-1) !== `${l.speaker}|${l.text}`) said.push(`${l.speaker}|${l.text}`);
    });
    await drive(w, w.runHandler("look_lamp", { world: w, target: "lamp", verb: "look" }));
    expect(said).toEqual(["moth|The lamp's been out for days.", "hero|I've got nothing to fill it with."]);
    expect(w.tileOf("hero")).toEqual({ x: 2, y: 0 });
  });

  it("routes choices through the UI and mirrors variables to flags", async () => {
    const w = new World(game, { autoAdvanceMs: 10 });
    w.start();
    new InkRunner(w, compileInk(source));
    await drive(w, w.runHandler("talk_moth", { world: w, target: "moth", verb: "talk" }), () => {
      if (w.ui.get().choices.length) w.choose(1);
    });
    expect(w.flag("door_open")).toBe(true);
  });

  it("saves and restores story state with the world", () => {
    const w = new World(game);
    w.start();
    const r = new InkRunner(w, compileInk(source));
    w.setFlag("door_open", true);
    const saved = w.serialize();
    expect(saved.script).toBeTypeOf("string");
    const w2 = new World(game);
    const r2 = new InkRunner(w2, compileInk(source));
    w2.load(saved);
    expect(r2.story.variablesState["door_open" as never]).toBe(true);
    expect(r).toBeDefined();
  });
});
