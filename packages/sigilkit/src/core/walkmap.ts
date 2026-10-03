import { ArrayTilemap } from "grid-engine";
import type { RoomDef } from "./types";

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

export function tilemapFor(room: RoomDef): { tilemap: ArrayTilemap; walkmap: Walkmap } {
  const walkmap = parseWalkmap(room.walkmap);
  const tilemap = new ArrayTilemap(
    { [CHAR_LAYER]: { data: walkmap.data, isCharLayer: true } },
    room.projection,
  );
  return { tilemap, walkmap };
}
