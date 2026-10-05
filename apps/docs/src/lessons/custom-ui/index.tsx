import { itemProps } from "../items/props";
import { startWorld } from "../../engine/session";
import { game } from "../items/game";
import story from "../items/story.ink?code";
import { defineLesson } from "../types";
import prose from "./lesson.md";
import { ClassicUi } from "./ui";
import uiSource from "./ui.tsx?code";
import uiStyles from "./ui.css?code";

export default defineLesson({
  prose,
  files: [
    { name: "ui.tsx", language: "tsx", file: uiSource },
    { name: "ui.css", language: "css", file: uiStyles },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => ({
    world: await startWorld(game, sources["story.ink"]),
    // SCUMM-style speech above the speaker, drawn by the renderer.
    stage: { overheadSpeech: true, props: itemProps },
    ui: ClassicUi,
  }),
});
