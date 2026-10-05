import type { ProjectionKind, RoomDef, Shape, TilePos, Vec2 } from "./types";

/**
 * Tile <-> room-pixel math. Everything spatial (rendering, pointer picking,
 * depth sorting, smooth movement) goes through this, so a room switches
 * between orthogonal and isometric by changing one field.
 */
export interface Projection {
  readonly kind: ProjectionKind;
  /** Foot point (where a sprite's anchor sits) for a fractional tile position. */
  tileToScreen(x: number, y: number): Vec2;
  /** Tile under a room-pixel point. May be off-grid; callers bounds-check. */
  screenToTile(px: number, py: number): TilePos;
  /** Sort key: larger draws in front. */
  depth(x: number, y: number): number;
  /** Pixel bounds of a grid of the given size. */
  bounds(cols: number, rows: number): { x: number; y: number; width: number; height: number };
}

export function orthogonal(tw: number, th: number, origin: Vec2 = { x: 0, y: 0 }): Projection {
  return {
    kind: "orthogonal",
    tileToScreen: (x, y) => ({ x: origin.x + (x + 0.5) * tw, y: origin.y + (y + 0.5) * th }),
    screenToTile: (px, py) => ({
      x: Math.floor((px - origin.x) / tw),
      y: Math.floor((py - origin.y) / th),
    }),
    depth: (_x, y) => y,
    bounds: (cols, rows) => ({ x: origin.x, y: origin.y, width: cols * tw, height: rows * th }),
  };
}

/**
 * Diamond isometric. origin is the top corner of tile (0,0).
 * Tile (x,y)'s centre sits at origin + ((x - y) * tw/2, (x + y + 1) * th/2).
 */
export function isometric(tw: number, th: number, origin: Vec2 = { x: 0, y: 0 }): Projection {
  const hw = tw / 2;
  const hh = th / 2;
  return {
    kind: "isometric",
    tileToScreen: (x, y) => ({ x: origin.x + (x - y) * hw, y: origin.y + (x + y + 1) * hh }),
    screenToTile: (px, py) => {
      const dx = (px - origin.x) / hw;
      const dy = (py - origin.y) / hh;
      return { x: Math.floor((dx + dy) / 2), y: Math.floor((dy - dx) / 2) };
    },
    depth: (x, y) => x + y,
    bounds: (cols, rows) => ({
      x: origin.x - rows * hw,
      y: origin.y,
      width: (cols + rows) * hw,
      height: (cols + rows) * hh,
    }),
  };
}

/**
 * Hotspot shape covering a block of tiles, optionally raised by `lift` pixels
 * so it also covers art standing on those tiles (a cabinet, a solar panel).
 * Lets you author hotspots in tile space and keep them right in either projection.
 * In a multi-level room, `level` raises the whole shape to that floor.
 */
export function tileArea(room: RoomDef, x: number, y: number, w = 1, h = 1, lift = 0, level?: string): Shape {
  const p = projectionFor(room);
  const levelElevation = level ? (room.levels?.find((levelDef) => levelDef.id === level)?.elevation ?? 0) : 0;
  const raised = (point: Vec2): Vec2 => ({ x: point.x, y: point.y - levelElevation });
  const top = raised(p.tileToScreen(x - 0.5, y - 0.5));
  const right = raised(p.tileToScreen(x + w - 0.5, y - 0.5));
  const bottom = raised(p.tileToScreen(x + w - 0.5, y + h - 0.5));
  const left = raised(p.tileToScreen(x - 0.5, y + h - 0.5));
  const pts =
    p.kind === "isometric"
      ? [top.x, top.y - lift, right.x, right.y - lift, right.x, right.y, bottom.x, bottom.y, left.x, left.y, left.x, left.y - lift]
      : [top.x, top.y - lift, right.x, right.y - lift, bottom.x, bottom.y, left.x, left.y];
  return { polygon: pts };
}

export function projectionFor(room: RoomDef): Projection {
  const { width, height } = room.tile;
  const rows = room.walkmap.length;
  if (room.projection === "isometric") {
    // Default origin keeps the whole diamond on-canvas.
    const origin = room.origin ?? { x: rows * (width / 2), y: 0 };
    return isometric(width, height, origin);
  }
  return orthogonal(width, height, room.origin ?? { x: 0, y: 0 });
}
