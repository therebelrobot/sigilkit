import { startWorld, walkmapRows } from "../../engine/session";
import { defineLesson } from "../types";
import { createGame } from "./game";
import game from "./game.ts?code";
import prose from "./lesson.md";
import walkmap from "./walkmap.txt?code";

export default defineLesson({
  prose,
  files: [
    { name: "walkmap.txt", language: "walkmap", file: walkmap, editable: true },
    { name: "game.ts", language: "ts", file: game },
  ],
  start: async (sources) => ({ world: await startWorld(createGame(walkmapRows(sources["walkmap.txt"]!))) }),
});
