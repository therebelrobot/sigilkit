import { useWorld } from "sigilkit/react";
import { useEffect } from "react";
import { startWorld } from "../../engine/session";
import { game } from "../hotspots/game";
import { defineLesson } from "../types";
import { startControls } from "./controls";
import controlsSource from "./controls.ts?code";
import prose from "./lesson.md";
import { Prompts } from "./prompts";
import promptsSource from "./prompts.tsx?code";

/** Starts the lesson's own controls, active only while this demo has focus. */
function ControlsAndPrompts() {
  const world = useWorld();
  useEffect(() => {
    const isActive = () => {
      const focused = document.activeElement;
      return !!focused?.closest(".playground") && !(focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement);
    };
    return startControls(world, isActive);
  }, [world]);
  return <Prompts />;
}

export default defineLesson({
  prose,
  files: [
    { name: "controls.ts", language: "ts", file: controlsSource },
    { name: "prompts.tsx", language: "tsx", file: promptsSource },
  ],
  start: async () => ({ world: await startWorld(game), input: false, controls: ControlsAndPrompts }),
});
