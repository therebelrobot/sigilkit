import type { World, WorldState } from "sigilkit";

const SAVE_KEY = "sigilkit-lesson-save";

/** The whole game as JSON: room, actors, inventory, flags, revealed areas, changed tiles, and the Ink state. */
export function saveGame(world: World): WorldState {
  const state = world.serialize();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing or full storage: keep playing; the save just won't persist.
  }
  return state;
}

export function loadGame(world: World): WorldState | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  const state = JSON.parse(raw) as WorldState;
  // Don't load in the middle of a script: the story would resume somewhere odd.
  if (world.ui.get().busy) return null;
  world.load(state);
  return state;
}
