import type { ActorView, Facing, Projection, PropDef, World } from "../core/index";
import { Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";

/** How the renderer draws one actor. Swap in anything: spritesheets, Spine, a single PNG. */
export interface ActorDisplay {
  readonly view: Container;
  update(view: ActorView, deltaMs: number): void;
  destroy(): void;
}

export type ActorFactory = (spriteKey: string, actorId: string) => ActorDisplay;

/** An animated piece of scenery. Updated every frame; depth-sorted with actors. */
export interface PropDisplay {
  readonly view: Container;
  update?(deltaMs: number, world: World): void;
  destroy(): void;
}

/**
 * Builds displays for a room's props. Return null to fall back to the prop's
 * static `asset` (or draw nothing if it has none).
 */
export type PropFactory = (prop: PropDef, ctx: { world: World; projection: Projection }) => PropDisplay | null | undefined;

/** Colored stand-in with a facing nub and a walk bob, so you can block out rooms before art exists. */
export function placeholderActor(color: number, size = 14): ActorDisplay {
  const root = new Container();
  const shadow = new Graphics().ellipse(0, 0, size * 0.45, size * 0.18).fill({ color: 0x000000, alpha: 0.3 });
  const body = new Graphics()
    .roundRect(-size / 2, -size * 1.6, size, size * 1.6, size * 0.35)
    .fill(color)
    .stroke({ width: 1, color: 0x000000, alpha: 0.5 });
  const nub = new Graphics().circle(0, 0, size * 0.16).fill(0xffffff);
  root.addChild(shadow, body, nub);
  let t = 0;
  const NUB: Record<string, [number, number]> = {
    up: [0, -1.35], down: [0, -0.95], left: [-0.32, -1.15], right: [0.32, -1.15],
  };
  return {
    view: root,
    update(v, dt) {
      t = v.moving ? t + dt : 0;
      body.y = v.moving ? -Math.abs(Math.sin(t / 90)) * 2 : 0;
      const dir = v.facing.split("-")[0]!;
      const [nx, ny] = NUB[dir] ?? NUB.down!;
      nub.position.set(nx * size, ny * size + body.y);
      nub.visible = dir !== "up";
    },
    destroy: () => root.destroy({ children: true }),
  };
}

export interface SheetSpec {
  texture: Texture;
  frameWidth: number;
  frameHeight: number;
  /** Row index for each facing. Diagonals fall back to their horizontal half. */
  rows: Partial<Record<Facing, number>>;
  /** Frame columns used while walking; column 0 is idle unless idleFrame says otherwise. */
  walkFrames: number[];
  idleFrame?: number;
  fps?: number;
  /** Anchor in frame pixels; default bottom-centre. */
  anchor?: { x: number; y: number };
}

/** Classic grid spritesheet: one row per facing, columns are frames. */
export function sheetActor(spec: SheetSpec): ActorDisplay {
  const frames = new Map<string, Texture>();
  const frame = (row: number, col: number) => {
    const key = `${row}:${col}`;
    let tex = frames.get(key);
    if (!tex) {
      tex = new Texture({
        source: spec.texture.source,
        frame: new Rectangle(col * spec.frameWidth, row * spec.frameHeight, spec.frameWidth, spec.frameHeight),
      });
      frames.set(key, tex);
    }
    return tex;
  };
  const sprite = new Sprite(frame(0, spec.idleFrame ?? 0));
  sprite.anchor.set(
    (spec.anchor?.x ?? spec.frameWidth / 2) / spec.frameWidth,
    (spec.anchor?.y ?? spec.frameHeight) / spec.frameHeight,
  );
  const ms = 1000 / (spec.fps ?? 8);
  let t = 0;
  const rowFor = (f: Facing) =>
    spec.rows[f] ?? spec.rows[f.split("-")[1] as Facing] ?? spec.rows[f.split("-")[0] as Facing] ?? 0;
  return {
    view: sprite,
    update(v, dt) {
      t = v.moving ? t + dt : 0;
      const col = v.moving ? spec.walkFrames[Math.floor(t / ms) % spec.walkFrames.length]! : (spec.idleFrame ?? 0);
      sprite.texture = frame(rowFor(v.facing), col);
    },
    destroy: () => {
      sprite.destroy();
      for (const tex of frames.values()) tex.destroy(false);
    },
  };
}
