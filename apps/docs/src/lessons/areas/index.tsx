import { useUi, useWorld } from "sigilkit/react";
import { useEffect, useState } from "react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import story from "./story.ink?code";

/** Live area readouts, plus revealing the annex from code the way `>>> reveal annex` does. */
function AreaControls() {
  const world = useWorld();
  useUi();
  const [, setTick] = useState(0);
  useEffect(() => {
    const offs = [world.events.on("areaChanged", () => setTick((tick) => tick + 1)), world.events.on("areaRevealed", () => setTick((tick) => tick + 1))];
    return () => offs.forEach((off) => off());
  }, [world]);
  const revealed = world.isAreaRevealed("annex");
  return (
    <>
      <button type="button" disabled={revealed} onClick={() => void world.command("reveal annex")}>
        {revealed ? "annex revealed" : ">>> reveal annex"}
      </button>
      <span className="readout">
        area: {world.areaOf()?.id ?? "outside"} · cutaway: {world.cutaway()?.id ?? "none"}
      </span>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), controls: AreaControls }),
});
