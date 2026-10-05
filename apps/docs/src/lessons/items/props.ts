import type { PropFactory } from "sigilkit/pixi";
import { Container, Graphics } from "pixi.js";

/** A little copper watering can on the bench, gone once it's taken. */
export const itemProps: PropFactory = (prop, { world }) => {
  if (prop.id !== "can") return null;
  const view = new Container();
  const can = new Graphics()
    .rect(-4, -18, 8, 8).fill(0xc87f4a)
    .poly([4, -16, 9, -21, 10, -20, 5, -14]).fill(0xc87f4a)
    .rect(-3, -21, 6, 2).fill(0x9a5a33);
  view.addChild(can);
  return {
    view,
    update: () => (view.visible = !world.flag("took_can")),
    destroy: () => view.destroy({ children: true }),
  };
};
