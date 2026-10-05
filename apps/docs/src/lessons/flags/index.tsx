import { useWorld } from "sigilkit/react";
import { useEffect, useState } from "react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import { attachLights } from "./lights";
import lightsSource from "./lights.ts?code";
import story from "./story.ink?code";

/** A toolbar button that flips the flag from TypeScript, to show the sync goes both ways. */
function PowerControls() {
  const world = useWorld();
  const [power, setPower] = useState(world.flag("power") === true);
  useEffect(() => world.events.on("flag", ({ name, value }) => name === "power" && setPower(value === true)), [world]);
  return (
    <>
      <button type="button" aria-pressed={power} onClick={() => world.setFlag("power", !power)}>
        world.setFlag("power", {String(!power)})
      </button>
      <span className="readout">flips: {String(world.flag("switch_flips"))}</span>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "story.ink", language: "ink", file: story, editable: true },
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "lights.ts", language: "ts", file: lightsSource },
  ],
  start: async (sources) => {
    const world = await startWorld(game, sources["story.ink"]);
    return { world, attach: (renderer) => attachLights(world, renderer), controls: PowerControls };
  },
});
