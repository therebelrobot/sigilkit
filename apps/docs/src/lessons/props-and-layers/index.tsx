import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { attachEffects } from "./effects";
import effectsSource from "./effects.ts?code";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import { props } from "./props";
import propsSource from "./props.ts?code";
import story from "./story.ink?code";

export default defineLesson({
  prose,
  files: [
    { name: "props.ts", language: "ts", file: propsSource },
    { name: "effects.ts", language: "ts", file: effectsSource },
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => {
    const world = await startWorld(game, sources["story.ink"]);
    return { world, stage: { props }, attach: (renderer) => attachEffects(world, renderer) };
  },
});
