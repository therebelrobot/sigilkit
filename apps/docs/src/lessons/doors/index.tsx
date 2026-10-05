import { useWorld } from "sigilkit/react";
import { useEffect, useState } from "react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import { startPatrol } from "./patrol";
import patrolSource from "./patrol.ts?code";
import story from "./story.ink?code";

/** Open and shut the gate, and knock through or fill in the second gap, while Moth walks. */
function DoorControls() {
  const world = useWorld();
  const [, setTick] = useState(0);
  useEffect(() => world.events.on("walkableChanged", () => setTick((tick) => tick + 1)), [world]);
  const gateOpen = world.isDoorOpen("gate");
  const gapOpen = world.layout.walkable("ground", 9, 8);
  return (
    <>
      <button type="button" aria-pressed={gateOpen} onClick={() => world.setFlag("gate_open", !gateOpen)}>
        gate: {gateOpen ? "open" : "shut"}
      </button>
      <button type="button" aria-pressed={!gapOpen} onClick={() => void world.command(gapOpen ? "block 9 8" : "unblock 9 8")}>
        {gapOpen ? ">>> block 9 8 (rockfall)" : ">>> unblock 9 8 (dig out)"}
      </button>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "patrol.ts", language: "ts", file: patrolSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => {
    const world = await startWorld(game, sources["story.ink"]);
    const stopPatrol = startPatrol(world);
    return { world, controls: DoorControls, dispose: stopPatrol };
  },
});
