import { itemProps } from "./props";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import story from "./story.ink?code";

export default defineLesson({
  prose,
  files: [
    { name: "story.ink", language: "ink", file: story, editable: true },
    { name: "game.ts", language: "ts", file: gameSource },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), stage: { props: itemProps } }),
});
