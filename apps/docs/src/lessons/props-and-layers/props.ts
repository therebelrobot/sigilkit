import type { World } from "sigilkit";
import type { PropDisplay, PropFactory } from "sigilkit/pixi";
import { Container, Graphics } from "pixi.js";

/**
 * Draws this room's props. The renderer puts each view on its tile's foot
 * point, sorts it with the actors, and calls update() every frame. Return null
 * for props this factory doesn't know, and their static `asset` is used.
 */
export const props: PropFactory = (prop, { world }) => {
  if (prop.id === "lamp") return lampPost(world);
  if (prop.id === "pinwheel") return pinwheel();
  return null;
};

/** A lamp that flickers, and goes dark while the `lamp_lit` flag is false. */
function lampPost(world: World): PropDisplay {
  const view = new Container();
  const post = new Graphics()
    .ellipse(0, 0, 6, 3).fill({ color: 0x000000, alpha: 0.3 })
    .rect(-1.5, -36, 3, 36).fill(0x2b3a36)
    .rect(-4, -43, 8, 8).fill(0x55635d);
  const glow = new Graphics()
    .circle(0, -39, 18).fill({ color: 0xffd98a, alpha: 0.18 })
    .circle(0, -39, 9).fill({ color: 0xffe2a0, alpha: 0.35 })
    .circle(0, -39, 3).fill(0xfff4cf);
  view.addChild(post, glow);
  let elapsedMs = 0;
  return {
    view,
    update(deltaMs) {
      elapsedMs += deltaMs;
      glow.visible = world.flag("lamp_lit") !== false;
      const flicker = Math.random() < 0.015 ? 0.45 : 0;
      glow.alpha = 0.85 + Math.sin(elapsedMs / 110) * 0.1 - flicker;
    },
    destroy: () => view.destroy({ children: true }),
  };
}

/** Four blades on a stick, turning in a breeze that comes and goes. */
function pinwheel(): PropDisplay {
  const view = new Container();
  const stick = new Graphics().rect(-1, -26, 2, 26).fill(0x8a7a5c);
  const blades = new Container();
  blades.position.set(0, -26);
  const colors = [0xf2a7a0, 0x9fe0d4, 0xf3d27a, 0xc8e86a];
  colors.forEach((color, index) => {
    const blade = new Graphics().poly([0, 0, 9, -3, 7, 3]).fill(color);
    blade.rotation = (index * Math.PI) / 2;
    blades.addChild(blade);
  });
  view.addChild(stick, blades);
  let elapsedMs = 0;
  return {
    view,
    update(deltaMs) {
      elapsedMs += deltaMs;
      const breeze = 0.5 + Math.sin(elapsedMs / 1400) * 0.5;
      blades.rotation += deltaMs * 0.012 * breeze;
    },
    destroy: () => view.destroy({ children: true }),
  };
}
