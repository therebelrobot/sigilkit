import type { AreaDef, LevelTilePos, RoomDef, TilePos } from "./types";

/** Id of a room's base level when `RoomDef.baseLevel` isn't set. */
export const DEFAULT_BASE_LEVEL = "ground";

/**
 * Draw order mixes floor position with height: things sort by where their foot
 * would be on the base floor, plus this much per pixel of elevation. It's small
 * enough never to jump past a neighbouring tile, and large enough that a raised
 * thing draws over a lower thing on the same tile.
 */
export const ELEVATION_SORT_BIAS = 0.01;

export interface LayoutLevel {
  id: string;
  elevation: number;
  /** 0 for the base level, increasing with elevation. */
  index: number;
  /** Walkmap rows padded to the room's full grid size. */
  rows: string[];
  /** 0 walkable, 1 blocked, the shape grid-engine wants. Stair steps are already opened up. */
  blockedData: number[][];
  /** Area key per tile, or null. */
  areaKeys: (string | null)[][];
}

/** One staircase's ends: climbing goes from `lastStep` on the lower level to `top` on the upper one. */
export interface StairEnds {
  fromLevel: string;
  toLevel: string;
  lastStep: TilePos;
  top: TilePos;
}

const NO_AREA = new Set([" ", "."]);

/**
 * Everything spatial about a room beyond projection: which levels exist, what's
 * walkable on each, how high each tile is (stair steps rise between levels), and
 * which area each tile belongs to. Built once per room; pure data, no DOM.
 */
export class RoomLayout {
  readonly baseLevel: string;
  readonly levels: LayoutLevel[] = [];
  readonly cols: number;
  readonly rows: number;
  /** Each staircase's two ends, where actors change level. */
  readonly stairEnds: StairEnds[] = [];
  /** Every stair step, with the height it stands at. */
  readonly steps: { x: number; y: number; level: string; elevation: number }[] = [];
  readonly areas: AreaDef[];
  #levelById = new Map<string, LayoutLevel>();
  #stepElevationByKey = new Map<string, number>();
  #areaByKey = new Map<string, AreaDef>();
  #explicitClearanceByKey = new Map<string, number>();
  /** Walkability as authored (stair steps opened), before doors and scripts change it. */
  #authoredBlockedByLevel = new Map<string, number[][]>();
  #clearanceByKey = new Map<string, number>();
  #areaById = new Map<string, AreaDef>();

  constructor(readonly room: RoomDef) {
    this.baseLevel = room.baseLevel ?? DEFAULT_BASE_LEVEL;
    const levelSources = [
      { id: this.baseLevel, elevation: 0, walkmap: room.walkmap, areamap: room.areamap },
      ...[...(room.levels ?? [])].sort((first, second) => first.elevation - second.elevation),
    ];
    this.cols = Math.max(0, ...levelSources.flatMap((level) => level.walkmap.map((row) => row.length)));
    this.rows = Math.max(0, ...levelSources.map((level) => level.walkmap.length));

    this.areas = room.areas ?? [];
    for (const area of this.areas) {
      if (area.key.length !== 1) throw new Error(`room "${room.id}": area "${area.id}" key must be one character`);
      if (NO_AREA.has(area.key)) throw new Error(`room "${room.id}": area "${area.id}" can't use "${area.key}" as its key`);
      this.#areaByKey.set(area.key, area);
      this.#areaById.set(area.id, area);
    }

    levelSources.forEach((source, index) => {
      if (this.#levelById.has(source.id)) throw new Error(`room "${room.id}": level "${source.id}" is defined twice`);
      const rows = Array.from({ length: this.rows }, (_, tileY) => (source.walkmap[tileY] ?? "").padEnd(this.cols, " "));
      const blockedData = rows.map((row) => [...row].map((character) => (character === "." ? 0 : 1)));
      const areaKeys = Array.from({ length: this.rows }, (_, tileY) =>
        Array.from({ length: this.cols }, (_, tileX) => {
          const character = source.areamap?.[tileY]?.[tileX];
          if (character === undefined || NO_AREA.has(character)) return null;
          if (!this.#areaByKey.has(character))
            throw new Error(`room "${room.id}": areamap letter "${character}" on level "${source.id}" has no area with that key`);
          return character;
        }),
      );
      const level: LayoutLevel = { id: source.id, elevation: source.elevation, index, rows, blockedData, areaKeys };
      this.levels.push(level);
      this.#levelById.set(level.id, level);
    });

    for (const stair of room.stairs ?? []) this.#addStair(stair.from ?? this.baseLevel, stair.to, stair.steps, stair.top);
    for (const level of this.levels) this.#authoredBlockedByLevel.set(level.id, level.blockedData.map((row) => [...row]));
    for (const door of room.doors ?? []) {
      const levelId = door.level ?? this.baseLevel;
      this.level(levelId);
      for (const tile of door.tiles)
        if (!this.walkable(levelId, tile.x, tile.y))
          throw new Error(`room "${room.id}": door "${door.id}" tile (${tile.x}, ${tile.y}) must be '.' in the walkmap of "${levelId}"`);
    }
    for (const clearance of room.clearances ?? []) {
      const levelId = clearance.level ?? this.baseLevel;
      this.level(levelId);
      for (const tile of clearance.tiles) {
        const clearanceKey = stepKey(levelId, tile.x, tile.y);
        this.#explicitClearanceByKey.set(clearanceKey, Math.min(clearance.height, this.#explicitClearanceByKey.get(clearanceKey) ?? Infinity));
      }
    }
  }

  /** Walkability as written in the room, before doors and scripts. */
  authoredWalkable(levelId: string, tileX: number, tileY: number): boolean {
    return this.#authoredBlockedByLevel.get(levelId)?.[tileY]?.[tileX] === 0;
  }

  /**
   * Change a tile's walkability at runtime. Returns whether anything changed. The World
   * calls this for doors and `setWalkable`; game code should go through the World.
   */
  setWalkable(levelId: string, tileX: number, tileY: number, walkable: boolean): boolean {
    const row = this.level(levelId).blockedData[tileY];
    if (!row || row[tileX] === undefined) return false;
    const blocked = walkable ? 0 : 1;
    if (row[tileX] === blocked) return false;
    row[tileX] = blocked;
    this.#clearanceByKey.clear(); // floors overhead may have changed
    return true;
  }

  /**
   * Headroom above a tile's floor, in pixels: up to the nearest floor, step or wall
   * on a higher level over the same tile, or a `clearances` entry if that's lower.
   * Infinity when nothing is overhead.
   */
  clearanceAt(levelId: string, tileX: number, tileY: number): number {
    const clearanceKey = stepKey(levelId, tileX, tileY);
    const cached = this.#clearanceByKey.get(clearanceKey);
    if (cached !== undefined) return cached;
    const floorElevation = this.elevationAt(levelId, tileX, tileY);
    let clearance = this.#explicitClearanceByKey.get(clearanceKey) ?? Infinity;
    for (const level of this.levels) {
      const isSomethingOverhead =
        this.walkable(level.id, tileX, tileY) || this.characterAt(level.id, tileX, tileY) === "#" || this.isStep(level.id, tileX, tileY);
      if (!isSomethingOverhead) continue;
      const heightAbove = this.elevationAt(level.id, tileX, tileY) - floorElevation;
      if (heightAbove > 0) clearance = Math.min(clearance, heightAbove);
    }
    this.#clearanceByKey.set(clearanceKey, clearance);
    return clearance;
  }

  get isMultiLevel(): boolean {
    return this.levels.length > 1;
  }

  hasLevel(levelId: string): boolean {
    return this.#levelById.has(levelId);
  }

  level(levelId: string = this.baseLevel): LayoutLevel {
    const level = this.#levelById.get(levelId);
    if (!level) throw new Error(`room "${this.room.id}" has no level "${levelId}"`);
    return level;
  }

  /** Levels from the highest down: the order to test when picking what's under the pointer. */
  get levelsFromTop(): LayoutLevel[] {
    return [...this.levels].sort((first, second) => second.elevation - first.elevation);
  }

  walkable(levelId: string, tileX: number, tileY: number): boolean {
    return this.#levelById.get(levelId)?.blockedData[tileY]?.[tileX] === 0;
  }

  characterAt(levelId: string, tileX: number, tileY: number): string | undefined {
    return this.#levelById.get(levelId)?.rows[tileY]?.[tileX];
  }

  isStep(levelId: string, tileX: number, tileY: number): boolean {
    return this.#stepElevationByKey.has(stepKey(levelId, tileX, tileY));
  }

  /** Floor height of a tile on a level, in pixels: the level's elevation, or a stair step's. */
  elevationAt(levelId: string, tileX: number, tileY: number): number {
    return this.#stepElevationByKey.get(stepKey(levelId, tileX, tileY)) ?? this.level(levelId).elevation;
  }

  areaAt(levelId: string, tileX: number, tileY: number): AreaDef | null {
    const areaKey = this.#levelById.get(levelId)?.areaKeys[tileY]?.[tileX];
    return areaKey ? (this.#areaByKey.get(areaKey) ?? null) : null;
  }

  area(areaId: string): AreaDef | undefined {
    return this.#areaById.get(areaId);
  }

  /** Every tile of an area, on whichever levels it spans. */
  areaTiles(areaId: string): Required<LevelTilePos>[] {
    const area = this.#areaById.get(areaId);
    if (!area) return [];
    const tiles: Required<LevelTilePos>[] = [];
    for (const level of this.levels)
      level.areaKeys.forEach((rowKeys, tileY) =>
        rowKeys.forEach((areaKey, tileX) => {
          if (areaKey === area.key) tiles.push({ x: tileX, y: tileY, level: level.id });
        }),
      );
    return tiles;
  }

  #addStair(fromLevelId: string, toLevelId: string, steps: TilePos[], top: TilePos): void {
    const where = `room "${this.room.id}": stairs from "${fromLevelId}" to "${toLevelId}"`;
    const fromLevel = this.level(fromLevelId);
    const toLevel = this.level(toLevelId);
    const lastStep = steps.at(-1);
    if (!lastStep) throw new Error(`${where} need at least one step`);
    if (fromLevel.elevation >= toLevel.elevation) throw new Error(`${where}: "${toLevelId}" must be higher than "${fromLevelId}"`);
    if (!this.walkable(toLevelId, top.x, top.y)) throw new Error(`${where}: the top (${top.x}, ${top.y}) must be walkable on "${toLevelId}"`);
    if (Math.max(Math.abs(top.x - lastStep.x), Math.abs(top.y - lastStep.y)) !== 1)
      throw new Error(`${where}: the top must be next to the last step`);

    steps.forEach((step, stepIndex) => {
      const row = fromLevel.blockedData[step.y];
      if (row?.[step.x] === undefined) throw new Error(`${where}: step (${step.x}, ${step.y}) is outside the room`);
      row[step.x] = 0;
      const climbFraction = (stepIndex + 1) / (steps.length + 1);
      const stepElevation = fromLevel.elevation + (toLevel.elevation - fromLevel.elevation) * climbFraction;
      this.#stepElevationByKey.set(stepKey(fromLevelId, step.x, step.y), stepElevation);
      this.steps.push({ x: step.x, y: step.y, level: fromLevelId, elevation: stepElevation });
    });
    this.stairEnds.push({ fromLevel: fromLevelId, toLevel: toLevelId, lastStep, top });
  }
}

const stepKey = (levelId: string, tileX: number, tileY: number) => `${levelId}:${tileX},${tileY}`;
