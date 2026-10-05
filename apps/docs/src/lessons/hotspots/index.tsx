import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";

export default defineLesson({
  prose,
  files: [{ name: "game.ts", language: "ts", file: gameSource }],
  start: async () => ({ world: await startWorld(game) }),
});
