import { ArrayTilemap } from "grid-engine";
import { RoomLayout } from "./levels";
import type { RoomDef } from "./types";

/** grid-engine layer for single-level rooms; multi-level rooms use one layer per level id. */
export const CHAR_LAYER = "ground";

export interface Walkmap {
  cols: number;
  rows: number;
  walkable(x: number, y: number): boolean;
}

/** Parse a room's ASCII walkmap. '.' is walkable; anything else blocks. */
export function parseWalkmap(lines: string[]): Walkmap & { data: number[][] } {
  const cols = Math.max(0, ...lines.map((l) => l.length));
  const data = lines.map((line) =>
    Array.from({ length: cols }, (_, x) => (line[x] === "." ? 0 : 1)),
  );
  return {
    cols,
    rows: data.length,
    data,
    walkable: (x, y) => data[y]?.[x] === 0,
  };
}

/**
 * The grid-engine tilemap for a room: one character layer per level, named by
 * level id. Levels aren't connected here; the World climbs stairs itself (see
 * `World.walk`). The returned `walkmap` is the base level, stair steps included.
 */
export function tilemapFor(room: RoomDef): { tilemap: ArrayTilemap; walkmap: Walkmap; layout: RoomLayout } {
  const layout = new RoomLayout(room);
  const tilemap = new ArrayTilemap(
    Object.fromEntries(layout.levels.map((level) => [level.id, { data: level.blockedData, isCharLayer: true }])),
    room.projection,
  );
  const baseLevel = layout.level();
  const walkmap: Walkmap = {
    cols: layout.cols,
    rows: layout.rows,
    walkable: (x, y) => baseLevel.blockedData[y]?.[x] === 0,
  };
  return { tilemap, walkmap, layout };
}
