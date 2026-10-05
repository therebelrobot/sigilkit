import type { World } from "sigilkit";
import { startGamepad, startKeyboard } from "sigilkit/input";

/**
 * Couch controls, plus one game-specific action: humming, on H or the Y button.
 * `isActive` lets a page with other things on it (like this one) hand keys
 * back to the browser when the game doesn't have focus.
 */
export function startControls(world: World, isActive: () => boolean = () => true): () => void {
  const hum = () => {
    if (!world.ui.get().busy && !world.ui.get().line) void world.say(world.player, "♪ Hmm hmm hmmm. ♪");
  };

  const keyboard = startKeyboard(world, {
    // Tab stays with the browser; ] and [ cycle focus.
    bindings: { next: ["]"], prev: ["["] },
    // Returning true consumes the key before the defaults see it.
    onKey: (event) => {
      if (!isActive()) return true;
      if (event.key.toLowerCase() === "h" && !event.repeat) {
        hum();
        return true;
      }
      return false;
    },
  });

  const gamepad = startGamepad(world, {
    onButton: (event) => {
      if (!isActive()) return true;
      if (event.button === "y" && event.pressed) {
        hum();
        return true;
      }
      return false;
    },
    // Returning true skips default movement and focus this frame.
    onFrame: () => !isActive(),
  });

  return () => {
    keyboard.stop();
    gamepad.stop();
  };
}
