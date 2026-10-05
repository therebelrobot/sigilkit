import { useUi, useWorld } from "sigilkit/react";
import { startWorld } from "../../engine/session";
import { defineLesson } from "../types";
import { game } from "./game";
import gameSource from "./game.ts?code";
import prose from "./lesson.md";
import story from "./story.ink?code";

/** Swap between the two versions of the room, keeping the player on the same tile. */
function ProjectionToggle() {
  const world = useWorld();
  const { room, busy } = useUi();
  const switchTo = async (target: string) => {
    if (target === room || busy) return;
    const tile = world.tileOf(world.player);
    const facing = world.state.actors[world.player]!.facing;
    await world.goto(target);
    world.place(world.player, tile);
    world.face(world.player, facing);
  };
  return (
    <>
      <span className="readout">projection:</span>
      <button type="button" aria-pressed={room === "courtyard-iso"} onClick={() => void switchTo("courtyard-iso")}>
        isometric
      </button>
      <button type="button" aria-pressed={room === "courtyard-flat"} onClick={() => void switchTo("courtyard-flat")}>
        orthogonal
      </button>
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "game.ts", language: "ts", file: gameSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), controls: ProjectionToggle }),
});
