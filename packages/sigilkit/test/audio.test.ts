import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AudioDirector } from "../src/audio/index";
import { defineGame, World } from "../src/core/index";

/** Just enough of Web Audio for AudioDirector's gain routing; records every scheduled target. */
class FakeGainNode {
  scheduledTargets: number[] = [];
  gain = {
    value: 1,
    setTargetAtTime: (target: number) => {
      this.scheduledTargets.push(target);
    },
  };
  connect<T>(destination: T): T {
    return destination;
  }
}

class FakeAudioContext {
  static created: FakeAudioContext[] = [];
  currentTime = 0;
  state = "running";
  destination = {};
  gainNodes: FakeGainNode[] = [];
  constructor() {
    FakeAudioContext.created.push(this);
  }
  createGain(): FakeGainNode {
    const gainNode = new FakeGainNode();
    this.gainNodes.push(gainNode);
    return gainNode;
  }
  close() {
    return Promise.resolve();
  }
}

const game = defineGame({
  title: "test",
  resolution: { width: 320, height: 180 },
  player: "hero",
  startRoom: "room",
  actors: { hero: { name: "Hero", sprite: "hero" } },
  rooms: {
    room: {
      id: "room",
      projection: "orthogonal",
      tile: { width: 16, height: 16 },
      walkmap: ["..."],
      hotspots: [],
    },
  },
});

describe("AudioDirector music ducking", () => {
  const originalAudioContext = globalThis.AudioContext;

  beforeEach(() => {
    FakeAudioContext.created = [];
    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
  });
  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
  });

  // Gain nodes are created music, sfx, duck, in that order.
  const duckGainOf = () => FakeAudioContext.created[0]!.gainNodes[2]!;

  it("multiplies reasons together and restores when they clear", () => {
    const world = new World(game);
    const audio = new AudioDirector(world, { resolve: (key) => key });
    const duckGain = duckGainOf();

    audio.duckMusic("weave", 0.5);
    audio.duckMusic("cutscene", 0.5);
    expect(duckGain.scheduledTargets.at(-1)).toBeCloseTo(0.25);

    audio.duckMusic("weave", 1);
    expect(duckGain.scheduledTargets.at(-1)).toBeCloseTo(0.5);
    audio.duckMusic("cutscene", 1);
    expect(duckGain.scheduledTargets.at(-1)).toBe(1);
  });

  it("stacks game reasons with dialog ducking", async () => {
    const world = new World(game);
    world.start();
    const audio = new AudioDirector(world, { resolve: (key) => key, duck: 0.5 });
    const duckGain = duckGainOf();

    audio.duckMusic("weave", 0.8);
    void world.say("hero", "hello");
    expect(duckGain.scheduledTargets.at(-1)).toBeCloseTo(0.4);

    world.advance();
    expect(duckGain.scheduledTargets.at(-1)).toBeCloseTo(0.8);
  });

  it("skips rescheduling tiny changes, but always lands exactly on full volume", () => {
    const world = new World(game);
    const audio = new AudioDirector(world, { resolve: (key) => key });
    const duckGain = duckGainOf();

    audio.duckMusic("weave", 0.5);
    const scheduledCount = duckGain.scheduledTargets.length;
    audio.duckMusic("weave", 0.505);
    expect(duckGain.scheduledTargets.length).toBe(scheduledCount);

    audio.duckMusic("weave", 0.995);
    audio.duckMusic("weave", 1);
    expect(duckGain.scheduledTargets.at(-1)).toBe(1);
  });
});
