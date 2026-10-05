import type { World } from "sigilkit";
import type { Renderer } from "sigilkit/pixi";
import { Graphics, type Ticker } from "pixi.js";

/**
 * Effects on the renderer's layers:
 * - floor:   footprints, under everything that stands up
 * - world:   fireflies, above actors and props (both layers follow the camera)
 * - overlay: a flash over the whole frame when the lamp changes
 */
export function attachEffects(world: World, renderer: Renderer): () => void {
  const footprints: Graphics[] = [];
  let lastTileKey = "";

  const fireflies = Array.from({ length: 9 }, (_, index) => {
    const dot = new Graphics().circle(0, 0, 1.2).fill(0xe8ff9a);
    renderer.layers.world.addChild(dot);
    return { dot, phase: index * 1.7, radius: 14 + (index % 3) * 9 };
  });

  const { width, height } = world.game.resolution;
  const flash = new Graphics().rect(0, 0, width, height).fill(0xfff4cf);
  flash.alpha = 0;
  renderer.layers.overlay.addChild(flash);
  const stopListening = world.events.on("flag", ({ name }) => {
    if (name === "lamp_lit") flash.alpha = 0.35;
  });

  let elapsedMs = 0;
  const tick = (ticker: Ticker) => {
    const deltaMs = ticker.deltaMS;
    elapsedMs += deltaMs;
    const player = world.actorViews().find((view) => view.id === world.player);
    if (!player) return;

    // A footprint each time the player reaches a new tile.
    const tile = world.tileOf(world.player);
    const tileKey = `${tile.x},${tile.y}`;
    if (tileKey !== lastTileKey) {
      lastTileKey = tileKey;
      const print = new Graphics().ellipse(0, 0, 4, 2).fill({ color: 0x0b1210, alpha: 0.5 });
      print.position.set(player.screen.x, player.screen.y);
      renderer.layers.floor.addChild(print);
      footprints.push(print);
    }
    for (const print of [...footprints]) {
      print.alpha -= deltaMs / 2500;
      if (print.alpha <= 0) {
        footprints.splice(footprints.indexOf(print), 1);
        print.destroy();
      }
    }

    // Fireflies circle the player, dimmer while the lamp is lit.
    const lampLit = world.flag("lamp_lit") !== false;
    for (const firefly of fireflies) {
      const angle = elapsedMs / 900 + firefly.phase;
      firefly.dot.position.set(
        player.screen.x + Math.cos(angle) * firefly.radius,
        player.screen.y - 20 + Math.sin(angle * 1.3) * firefly.radius * 0.5,
      );
      firefly.dot.alpha = (lampLit ? 0.35 : 0.9) * (0.6 + Math.sin(elapsedMs / 200 + firefly.phase) * 0.4);
    }

    flash.alpha = Math.max(0, flash.alpha - deltaMs / 400);
  };
  renderer.app.ticker.add(tick);

  return () => {
    renderer.app.ticker.remove(tick);
    stopListening();
    for (const node of [...footprints, ...fireflies.map((firefly) => firefly.dot), flash]) node.destroy();
  };
}
