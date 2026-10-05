import type { World } from "sigilkit";
import { AudioDirector } from "sigilkit/audio";
import { soundUrl } from "./sounds";

/**
 * The audio layer follows the world: room `music` crossfades, `>>> sfx` plays
 * a one-shot, and music ducks while a line of dialog is showing.
 */
export function createAudio(world: World): AudioDirector {
  return new AudioDirector(world, {
    // Asset key -> URL. Usually: (key) => `/audio/${key}.ogg`
    resolve: soundUrl,
    musicVolume: 0.5,
    sfxVolume: 0.8,
    duck: 0.35, // music gain while dialog shows (1 = no ducking)
    fade: 1.2, // crossfade seconds
  });
}

// Browsers start audio suspended until the player does something.
// <Stage onFirstGesture={() => void audio.unlock()} /> resumes it.
