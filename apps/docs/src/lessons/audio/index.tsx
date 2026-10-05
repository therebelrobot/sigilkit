import type { AudioDirector } from "sigilkit/audio";
import { useState } from "react";
import { startWorld } from "../../engine/session";
import { game } from "../rooms/game";
import { defineLesson } from "../types";
import { createAudio } from "./audio";
import audioSource from "./audio.ts?code";
import prose from "./lesson.md";
import soundsSource from "./sounds.ts?code";
import story from "./story.ink?code";

function mixerFor(audio: AudioDirector) {
  return function Mixer() {
    const [music, setMusic] = useState(0.5);
    const [sfx, setSfx] = useState(0.8);
    const [ducked, setDucked] = useState(false);
    return (
      <>
        <label className="slider">
          music
          <input type="range" min={0} max={1} step={0.05} value={music} onChange={(event) => (setMusic(+event.target.value), audio.setVolumes({ music: +event.target.value }))} />
        </label>
        <label className="slider">
          sfx
          <input type="range" min={0} max={1} step={0.05} value={sfx} onChange={(event) => (setSfx(+event.target.value), audio.setVolumes({ sfx: +event.target.value }))} />
        </label>
        <button type="button" aria-pressed={ducked} onClick={() => (audio.duckMusic("spell", ducked ? 1 : 0.15), setDucked(!ducked))}>
          duckMusic("spell", {ducked ? "1" : "0.15"})
        </button>
        <button type="button" onClick={() => void audio.unlock().then(() => audio.sfx("chime"))}>
          audio.sfx("chime")
        </button>
      </>
    );
  };
}

export default defineLesson({
  prose,
  files: [
    { name: "audio.ts", language: "ts", file: audioSource },
    { name: "story.ink", language: "ink", file: story, editable: true },
    { name: "sounds.ts", language: "ts", file: soundsSource },
  ],
  start: async (sources) => {
    const world = await startWorld(game, sources["story.ink"]);
    const audio = createAudio(world);
    return {
      world,
      stage: { onFirstGesture: () => void audio.unlock() },
      controls: mixerFor(audio),
      dispose: () => audio.dispose(),
    };
  },
});
