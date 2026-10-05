import { itemProps } from "../items/props";
import type { WorldState } from "sigilkit";
import { useUi, useWorld } from "sigilkit/react";
import { useState } from "react";
import { startWorld } from "../../engine/session";
import { game } from "../items/game";
import story from "../items/story.ink?code";
import { defineLesson } from "../types";
import prose from "./lesson.md";
import { loadGame, saveGame } from "./saves";
import savesSource from "./saves.ts?code";

/** The save itself, without the Ink blob (long and opaque), so the rest is readable. */
const readable = (state: WorldState) =>
  JSON.stringify({ ...state, script: state.script ? `<${state.script.length} characters of Ink state>` : undefined }, null, 2);

function SaveControls() {
  const world = useWorld();
  const { busy } = useUi();
  const [shown, setShown] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  return (
    <>
      <button type="button" disabled={busy} onClick={() => (setShown(readable(saveGame(world))), setMessage("saved"))}>
        Save
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const state = loadGame(world);
          setMessage(state ? "loaded" : "nothing saved yet");
          if (state) setShown(readable(state));
        }}
      >
        Load
      </button>
      <output>{message}</output>
      {shown && <pre aria-label="Saved state">{shown}</pre>}
    </>
  );
}

export default defineLesson({
  prose,
  files: [
    { name: "saves.ts", language: "ts", file: savesSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["story.ink"]), stage: { props: itemProps }, controls: SaveControls }),
});
