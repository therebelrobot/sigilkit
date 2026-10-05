import type { LevelTilePos } from "sigilkit";
import { useWorld } from "sigilkit/react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import story from "./story.ink?code";

const PLACES: { label: string; wren: LevelTilePos; pip: LevelTilePos }[] = [
  { label: "Both up to the deck", wren: { x: 6, y: 2, level: "deck" }, pip: { x: 7, y: 3, level: "deck" } },
  { label: "Both to the north side", wren: { x: 3, y: 4 }, pip: { x: 4, y: 4 } },
  { label: "Both to the south side", wren: { x: 2, y: 7 }, pip: { x: 4, y: 6 } },
];

/** Send both characters somewhere at once and watch them take different routes. */
function RouteControls() {
  const world = useWorld();
  return (
    <>
      {PLACES.map((place) => (
        <button
          type="button"
          key={place.label}
          onClick={() => {
            void world.walk("wren", place.wren);
            void world.walk("pip", place.pip);
          }}
        >
          {place.label}
        </button>
      ))}
      <span className="readout">fits(wren, arch): {String(world.fits("wren", { x: 4, y: 5 }, "ground"))}</span>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), controls: RouteControls }),
});
