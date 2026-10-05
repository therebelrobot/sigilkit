import type { World } from "sigilkit";
import type { Renderer } from "sigilkit/pixi";
import { Graphics } from "pixi.js";

/**
 * Darken the whole frame while the `power` flag is off. The overlay layer is in
 * logical screen pixels (the game's 320 × 180), above everything else.
 */
export function attachLights(world: World, renderer: Renderer): () => void {
  const { width, height } = world.game.resolution;
  const darkness = new Graphics().rect(0, 0, width, height).fill({ color: 0x02060a });
  renderer.layers.overlay.addChild(darkness);

  const update = () => (darkness.alpha = world.flag("power") === true ? 0 : 0.55);
  update();
  // Every flag change, from Ink, from a command or from TypeScript, emits "flag".
  const stopListening = world.events.on("flag", ({ name }) => {
    if (name === "power") update();
  });

  return () => {
    stopListening();
    darkness.destroy();
  };
}
