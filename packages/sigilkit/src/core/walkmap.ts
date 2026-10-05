import type { Tile, TileLayer, Tilemap } from "grid-engine";
import { RoomLayout } from "./levels";
import type { ProjectionKind, RoomDef } from "./types";

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
 * level id. Tiles read walkability live from the layout, so doors and
 * `World.setWalkable` take effect immediately (grid-engine's collision cache is
 * off by default, so nothing goes stale). Levels aren't connected here; the World
 * climbs stairs itself (see `World.walk`). The returned `walkmap` is the base level.
 */
export function tilemapFor(room: RoomDef): { tilemap: Tilemap; walkmap: Walkmap; layout: RoomLayout } {
  const layout = new RoomLayout(room);
  const walkmap: Walkmap = {
    cols: layout.cols,
    rows: layout.rows,
    walkable: (x, y) => layout.walkable(layout.baseLevel, x, y),
  };
  return { tilemap: new LiveLayoutTilemap(layout, room.projection), walkmap, layout };
}

const COLLIDE_PROPERTY = "ge_collide";

class LiveTile implements Tile {
  constructor(
    readonly layout: RoomLayout,
    readonly levelId: string,
    readonly tileX: number,
    readonly tileY: number,
  ) {}
  getProperty(name: string): boolean | undefined {
    return name === COLLIDE_PROPERTY ? !this.layout.walkable(this.levelId, this.tileX, this.tileY) : undefined;
  }
  hasProperty(name: string): boolean {
    return name === COLLIDE_PROPERTY;
  }
}

class LiveLevelLayer implements TileLayer {
  readonly tiles: LiveTile[][];
  constructor(
    readonly layout: RoomLayout,
    readonly levelId: string,
  ) {
    this.tiles = Array.from({ length: layout.rows }, (_, tileY) =>
      Array.from({ length: layout.cols }, (_, tileX) => new LiveTile(layout, levelId, tileX, tileY)),
    );
  }
  getName(): string {
    return this.levelId;
  }
  getProperty(name: string): string | undefined {
    return name === "ge_charLayer" ? this.levelId : undefined;
  }
  hasProperty(name: string): boolean {
    return name === "ge_charLayer";
  }
  getData(): LiveTile[][] {
    return this.tiles;
  }
  isCharLayer(): boolean {
    return true;
  }
}

class LiveLayoutTilemap implements Tilemap {
  readonly layers: LiveLevelLayer[];
  #layerById: Map<string, LiveLevelLayer>;
  constructor(
    readonly layout: RoomLayout,
    readonly orientation: ProjectionKind,
  ) {
    this.layers = layout.levels.map((level) => new LiveLevelLayer(layout, level.id));
    this.#layerById = new Map(this.layers.map((layer) => [layer.levelId, layer]));
  }
  getWidth(): number {
    return this.layout.cols;
  }
  getHeight(): number {
    return this.layout.rows;
  }
  getOrientation(): ProjectionKind {
    return this.orientation;
  }
  getLayers(): TileLayer[] {
    return this.layers;
  }
  hasTileAt(x: number, y: number, layer?: string): boolean {
    return !!layer && this.#layerById.has(layer) && x >= 0 && x < this.layout.cols && y >= 0 && y < this.layout.rows;
  }
  getTileAt(x: number, y: number, layer?: string): Tile | undefined {
    return layer ? this.#layerById.get(layer)?.tiles[y]?.[x] : undefined;
  }
}
