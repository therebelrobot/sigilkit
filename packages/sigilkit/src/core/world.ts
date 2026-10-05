import { Direction, GridEngineHeadless, NoPathFoundStrategy, type NumberOfDirections } from "grid-engine";
import { builtinCommands, tokenize, type CommandFn } from "./commands";
import { Emitter, Store } from "./events";
import { projectionFor, type Projection } from "./projection";
import { pointInShape, shapeCenter } from "./shapes";
import { ELEVATION_SORT_BIAS, RoomLayout } from "./levels";
import type {
  ActorPlacement,
  AreaDef,
  ActorState,
  ActorView,
  DialogChoice,
  Facing,
  FlagValue,
  GameDef,
  Handler,
  HotspotDef,
  LevelTilePos,
  RoomDef,
  ScriptContext,
  TilePos,
  UiState,
  Vec2,
  VerbId,
  WorldState,
} from "./types";
import { DEFAULT_VERBS, type DoorDef } from "./types";
import { tilemapFor, type Walkmap } from "./walkmap";

export interface ScriptRunner {
  /** Run a story path (e.g. an Ink knot) to completion. */
  run(path: string, ctx: ScriptContext): Promise<void>;
  save?(): string;
  load?(blob: string): void;
}

export interface WorldEvents extends Record<string, unknown> {
  roomChanged: { room: RoomDef; projection: Projection };
  music: { key: string | null };
  sfx: { key: string };
  flag: { name: string; value: FlagValue };
  error: { error: unknown; context: string };
  /** An actor started walking toward a tile (multiplayer clients send this as intent). */
  walk: { actor: string; to: LevelTilePos };
  /** The player walked into a different area (or out of every area, `area: null`). */
  areaChanged: { area: string | null; previous: string | null };
  /** An area with `reveal: "once"` was revealed for good. */
  areaRevealed: { room: string; area: string };
  /** Tiles changed walkability: a door opened or shut, or a script called `setWalkable`. */
  walkableChanged: { tiles: Required<LevelTilePos>[] };
  actorAdded: { actor: string };
  actorRemoved: { actor: string };
}

export interface WorldOptions {
  /** Resolve say() lines automatically after this many ms of world time. For servers and tests. */
  autoAdvanceMs?: number;
  /** Start in this room instead of game.startRoom (a multiplayer server pins one room per instance). */
  room?: string;
  /** Create the single-player actor. Default true; servers set false and add one actor per connection. */
  spawnPlayer?: boolean;
}

const NEIGHBOURS: [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];


const FACING_BY_DELTA: Record<string, Facing> = {
  "0,-1": "up", "1,0": "right", "0,1": "down", "-1,0": "left",
  "1,-1": "up-right", "1,1": "down-right", "-1,1": "down-left", "-1,-1": "up-left",
};
const DELTA_BY_FACING = Object.fromEntries(
  Object.entries(FACING_BY_DELTA).map(([k, f]) => [f, k.split(",").map(Number) as [number, number]]),
) as Record<Facing, [number, number]>;
const SCREEN_FACINGS: Facing[] = ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"];

/** Grid-space facing of a one-step move. */
export function facingOfStep(dx: number, dy: number): Facing {
  return FACING_BY_DELTA[`${Math.sign(dx)},${Math.sign(dy)}`] ?? "down";
}

/**
 * The 8-way direction a grid facing points on screen in a projection. In an
 * isometric room, walking grid-right travels down-right on screen; sprites should
 * pick their animation row from this, not from the grid facing.
 */
export function screenFacing(projection: Projection, facing: Facing): Facing {
  const [dx, dy] = DELTA_BY_FACING[facing];
  const a = projection.tileToScreen(0, 0);
  const b = projection.tileToScreen(dx, dy);
  const angle = Math.atan2(b.y - a.y, b.x - a.x); // 0 = right, +y is down
  const i = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return SCREEN_FACINGS[i]!;
}

export function facingToward(from: TilePos, to: TilePos): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return "down";
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

type Target =
  | { kind: "hotspot"; hotspot: HotspotDef }
  | { kind: "actor"; id: string }
  | { kind: "tile"; tile: Required<LevelTilePos> };

/**
 * The headless game. Owns state, movement and interaction; knows nothing about
 * pixels on a screen beyond room-space coordinates, so the same World runs in a
 * browser, a test, or a PartyServer room.
 */
export class World {
  readonly game: GameDef;
  readonly events = new Emitter<WorldEvents>();
  readonly ui: Store<UiState>;
  readonly commands: Map<string, CommandFn> = builtinCommands();
  readonly options: WorldOptions;

  state: WorldState;
  room!: RoomDef;
  projection!: Projection;
  /** The base level's walkability. Multi-level rooms: use `layout`. */
  walkmap!: Walkmap;
  /** Levels, stairs, elevations and areas of the current room. */
  layout!: RoomLayout;

  #grid = new GridEngineHeadless(false);
  #time = 0;
  #timers: { at: number; resolve: () => void }[] = [];
  #lineResolve: (() => void) | null = null;
  #choiceResolve: ((i: number) => void) | null = null;
  #runner: ScriptRunner | null = null;
  /** The tile step each moving actor is currently taking, for interpolation. */
  #steps = new Map<string, { from: TilePos; to: TilePos; fromLevel: string; toLevel: string }>();
  /** Actors mid-way through a stair's level-changing step, which the World animates itself. */
  #climbs = new Map<
    string,
    { from: TilePos; to: TilePos; fromLevel: string; toLevel: string; startedAt: number; durationMs: number; finished: Promise<boolean> }
  >();
  /** Bumped by every walk, so a newer walk cancels the rest of an older multi-level route. */
  #walkTokenByActor = new Map<string, number>();
  /** Area the player is standing in, tracked every update. */
  #playerArea: string | null = null;
  /** "level:x,y" keys of tiles cut away for the current interior. */
  #cutAwayTileKeys = new Set<string>();
  /** "level:x,y" keys of tiles whose walkability differs from the room as authored. */
  #changedTileKeys = new Set<string>();
  /** Bumped whenever walkability changes, so walks in progress know to re-plan. */
  #walkabilityGeneration = 0;
  /** Where each actor's current walk is headed, so it can re-plan when tiles change. */
  #walkDestinationByActor = new Map<string, Required<LevelTilePos>>();

  constructor(game: GameDef, options: WorldOptions = {}) {
    // A flag can open or shut a door.
    this.events.on("flag", () => {
      if (this.room) this.#applyWalkability();
    });
    // Copy the actor table so addActor() can extend it without touching shared content.
    this.game = { ...game, actors: { ...game.actors } };
    this.options = options;
    this.state = World.initialState(game);
    if (options.spawnPlayer === false) delete this.state.actors[game.player];
    if (options.room) {
      if (!game.rooms[options.room]) throw new Error(`unknown room "${options.room}"`);
      this.state.room = options.room;
    }
    this.ui = new Store<UiState>({
      line: null,
      choices: [],
      verb: "walk",
      heldItem: null,
      hover: null,
      busy: false,
      focus: null,
      choiceIndex: 0,
      inventory: [],
      room: this.state.room,
    });
  }

  static initialState(game: GameDef): WorldState {
    const actors: Record<string, ActorState> = {};
    for (const room of Object.values(game.rooms)) {
      for (const [id, p] of Object.entries(room.actors ?? {})) {
        actors[id] ??= {
          room: room.id,
          x: p.at.x,
          y: p.at.y,
          facing: p.facing ?? "down",
          visible: true,
          ...(p.level ? { level: p.level } : {}),
        };
      }
    }
    const start = game.rooms[game.startRoom];
    if (!start) throw new Error(`startRoom "${game.startRoom}" is not defined`);
    const entry = World.entryFor(start, game.startEntry);
    actors[game.player] = {
      room: start.id,
      x: entry.at.x,
      y: entry.at.y,
      facing: entry.facing ?? "down",
      visible: true,
      ...(entry.level ? { level: entry.level } : {}),
    };
    return { room: start.id, actors, inventory: [], flags: { ...game.flags } };
  }

  static entryFor(room: RoomDef, entry?: string): ActorPlacement {
    if (entry && room.entries?.[entry]) return room.entries[entry];
    const first = room.entries && Object.values(room.entries)[0];
    if (first) return first;
    // First walkable tile as a last resort.
    for (let y = 0; y < room.walkmap.length; y++) {
      const x = room.walkmap[y]!.indexOf(".");
      if (x >= 0) return { at: { x, y } };
    }
    throw new Error(`room "${room.id}" has no walkable tiles`);
  }

  // ---------------------------------------------------------------- lifecycle

  useScriptRunner(runner: ScriptRunner): void {
    this.#runner = runner;
  }

  /** Enter the starting room and run its onEnter. Call once after construction. */
  start(): void {
    this.#enter(this.state.room);
    const { onEnter } = this.room;
    if (onEnter) void this.#busy(() => this.runHandler(onEnter, { world: this, target: this.room.id, verb: "enter" }));
  }

  /** Advance world time. Drive this from the renderer's ticker or a server loop. */
  update(deltaMs: number): void {
    this.#time += deltaMs;
    this.#grid.update(this.#time, deltaMs);
    // Doors opened by a function can depend on anything, so check them each frame (cheap).
    if (this.room.doors?.some((door) => typeof door.openWhen === "function")) this.#applyWalkability();
    this.#trackPlayerArea(true);
    if (this.#timers.length) {
      const due = this.#timers.filter((t) => t.at <= this.#time);
      this.#timers = this.#timers.filter((t) => t.at > this.#time);
      for (const t of due) t.resolve();
    }
  }

  get time(): number {
    return this.#time;
  }

  // ----------------------------------------------------------------- queries

  get player(): string {
    return this.game.player;
  }

  actorsInRoom(): string[] {
    return Object.entries(this.state.actors)
      .filter(([, a]) => a.room === this.room.id)
      .map(([id]) => id);
  }

  tileOf(id: string): TilePos {
    if (this.#grid.hasCharacter(id)) return this.#grid.getPosition(id);
    const a = this.#actor(id);
    return { x: a.x, y: a.y };
  }

  /** Level an actor is on in the current room (the base level's id in single-level rooms). */
  levelOf(id: string): string {
    if (this.#grid.hasCharacter(id)) return this.#grid.getCharLayer(id) ?? this.layout.baseLevel;
    const level = this.state.actors[id]?.level;
    return level && this.layout.hasLevel(level) ? level : this.layout.baseLevel;
  }

  /** How tall an actor stands, in pixels: its `height`, or two tile heights. */
  heightOf(id: string): number {
    return this.game.actors[id]?.height ?? this.room.tile.height * 2;
  }

  /**
   * Whether an actor fits on a tile: it's walkable on that level, and the clearance
   * overhead (raised floors, `clearances`) is at least the actor's height.
   */
  fits(id: string, tile: TilePos, level: string): boolean {
    return this.layout.walkable(level, tile.x, tile.y) && this.layout.clearanceAt(level, tile.x, tile.y) >= this.heightOf(id);
  }

  /** Room-pixel point a tile's floor appears at on a level: its foot point, raised by the floor's height. */
  screenOf(tile: TilePos, level = this.layout.baseLevel): Vec2 {
    const floorPoint = this.projection.tileToScreen(tile.x, tile.y);
    return { x: floorPoint.x, y: floorPoint.y - this.layout.elevationAt(level, tile.x, tile.y) };
  }

  /** Renderer view: projected, depth-sorted, with smooth sub-tile movement and elevation. */
  actorViews(): ActorView[] {
    const views: ActorView[] = [];
    for (const id of this.actorsInRoom()) {
      const a = this.#actor(id);
      const def = this.game.actors[id];
      const tile = this.tileOf(id);
      const level = this.levelOf(id);
      let { x, y } = tile;
      let elevation = this.layout.elevationAt(level, tile.x, tile.y);
      const climb = this.#climbs.get(id);
      const moving = (this.#grid.hasCharacter(id) && this.#grid.isMoving(id)) || !!climb;
      const step = climb
        ? { ...climb, progress: Math.min(1, (this.#time - climb.startedAt) / climb.durationMs) }
        : moving
          ? this.#steps.get(id)
          : undefined;
      if (step) {
        // Interpolate along the step grid-engine is actually taking. Its own facing
        // can't be used for this: in isometric maps it reports screen directions.
        const t = "progress" in step ? step.progress : this.#grid.getMovementProgress(id) / 1000;
        x = step.from.x + (step.to.x - step.from.x) * t;
        y = step.from.y + (step.to.y - step.from.y) * t;
        const elevationLeaving = this.layout.elevationAt(step.fromLevel, step.from.x, step.from.y);
        const elevationEntering = this.layout.elevationAt(step.toLevel, step.to.x, step.to.y);
        elevation = elevationLeaving + (elevationEntering - elevationLeaving) * t;
      }
      const floorPoint = this.projection.tileToScreen(x, y);
      views.push({
        id,
        sprite: def?.sprite ?? id,
        screen: { x: floorPoint.x, y: floorPoint.y - elevation },
        depth: this.projection.depth(x, y),
        facing: a.facing,
        screenFacing: screenFacing(this.projection, a.facing),
        moving,
        visible: a.visible,
        level,
        elevation,
        sortY: floorPoint.y + elevation * ELEVATION_SORT_BIAS,
        area: this.layout.areaAt(level, tile.x, tile.y)?.id ?? null,
      });
    }
    return views.sort((first, second) => first.sortY - second.sortY);
  }

  /** Whether an actor can be seen and targeted: not in fog, not under a cut-away roof. */
  isActorShown(view: ActorView): boolean {
    if (!view.visible) return false;
    if (view.area && !this.isAreaRevealed(view.area)) return false;
    const tile = this.tileOf(view.id);
    return !this.isCutAway(view.level, tile.x, tile.y);
  }

  // ------------------------------------------------------------- walkability

  /** Whether a door in the current room is open. */
  isDoorOpen(doorId: string): boolean {
    const door = this.room.doors?.find((roomDoor) => roomDoor.id === doorId);
    if (!door) throw new Error(`room "${this.room.id}" has no door "${doorId}"`);
    return this.#doorIsOpen(door);
  }

  #doorIsOpen(door: DoorDef): boolean {
    return typeof door.openWhen === "string" ? Boolean(this.state.flags[door.openWhen]) : door.openWhen(this);
  }

  /**
   * Make a tile walkable or not, from now on: a wall knocked through, a rockfall, a
   * bridge burnt. Saved with the game. `null` puts the tile back the way the room
   * (and its doors) say. Actors mid-walk re-plan around the change.
   */
  setWalkable(tile: LevelTilePos, walkable: boolean | null, roomId: string = this.room.id): void {
    const level = tile.level ?? (roomId === this.room.id ? this.layout.baseLevel : (this.game.rooms[roomId]?.baseLevel ?? "ground"));
    const overrideKey = `${roomId}:${level}:${tile.x},${tile.y}`;
    const overrides = { ...this.state.walkable };
    if (walkable === null) delete overrides[overrideKey];
    else overrides[overrideKey] = walkable;
    this.state.walkable = overrides;
    if (roomId === this.room.id) this.#applyWalkability();
  }

  /**
   * Bring the layout in line with doors and saved overrides. Overrides win; then a
   * door's tiles are walkable only while it's open; everything else is as authored.
   */
  #applyWalkability(quietly = false): void {
    const desiredByKey = new Map<string, { level: string; x: number; y: number; walkable: boolean }>();
    for (const door of this.room.doors ?? []) {
      const level = door.level ?? this.layout.baseLevel;
      const open = this.#doorIsOpen(door);
      for (const tile of door.tiles) desiredByKey.set(`${level}:${tile.x},${tile.y}`, { level, x: tile.x, y: tile.y, walkable: open });
    }
    const roomPrefix = `${this.room.id}:`;
    for (const [overrideKey, walkable] of Object.entries(this.state.walkable ?? {})) {
      if (!overrideKey.startsWith(roomPrefix)) continue;
      const tileKey = overrideKey.slice(roomPrefix.length);
      const match = /^(.+):(-?\d+),(-?\d+)$/.exec(tileKey);
      if (!match || !this.layout.hasLevel(match[1]!)) continue;
      desiredByKey.set(tileKey, { level: match[1]!, x: Number(match[2]), y: Number(match[3]), walkable });
    }
    // Tiles changed before but no longer listed (an override cleared) go back to authored.
    for (const tileKey of this.#changedTileKeys) {
      if (desiredByKey.has(tileKey)) continue;
      const match = /^(.+):(-?\d+),(-?\d+)$/.exec(tileKey)!;
      const level = match[1]!;
      const tileX = Number(match[2]);
      const tileY = Number(match[3]);
      desiredByKey.set(tileKey, { level, x: tileX, y: tileY, walkable: this.layout.authoredWalkable(level, tileX, tileY) });
    }

    const changedTiles: Required<LevelTilePos>[] = [];
    for (const [tileKey, desired] of desiredByKey) {
      if (this.layout.setWalkable(desired.level, desired.x, desired.y, desired.walkable))
        changedTiles.push({ x: desired.x, y: desired.y, level: desired.level });
      if (desired.walkable === this.layout.authoredWalkable(desired.level, desired.x, desired.y)) this.#changedTileKeys.delete(tileKey);
      else this.#changedTileKeys.add(tileKey);
    }
    if (!changedTiles.length) return;
    this.#cutAwayTileKeys = this.#computeCutAway();
    if (quietly) return;
    this.#walkabilityGeneration++;
    this.events.emit("walkableChanged", { tiles: changedTiles });
    // Anyone mid-walk stops; their walk sees the change and re-plans from where they are,
    // around a door that just shut or through one that just opened.
    for (const actorId of this.#walkDestinationByActor.keys()) {
      if (this.#grid.hasCharacter(actorId) && !this.#climbs.has(actorId)) this.#grid.stopMovement(actorId);
    }
  }

  // ------------------------------------------------------------------ areas

  /** The area an actor stands in, if any. */
  areaOf(id: string = this.player): AreaDef | null {
    const tile = this.tileOf(id);
    return this.layout.areaAt(this.levelOf(id), tile.x, tile.y);
  }

  /** Whether an area's contents can be seen right now (see `AreaDef.reveal`). */
  isAreaRevealed(areaId: string): boolean {
    const area = this.layout.area(areaId);
    if (!area) return true;
    if (area.reveal === "inside") return this.#playerArea === areaId;
    if (area.reveal === "once") return this.#playerArea === areaId || (this.state.revealed ?? []).includes(`${this.room.id}:${areaId}`);
    return true;
  }

  /** Reveal a `reveal: "once"` area for good, without walking in (a map, a window, a script). */
  revealArea(areaId: string): void {
    const area = this.layout.area(areaId);
    if (!area || area.reveal !== "once") return;
    const revealedKey = `${this.room.id}:${areaId}`;
    if ((this.state.revealed ?? []).includes(revealedKey)) return;
    this.state.revealed = [...(this.state.revealed ?? []), revealedKey];
    this.events.emit("areaRevealed", { room: this.room.id, area: areaId });
  }

  /** The interior the player is inside, whose front walls and everything above are cut away. */
  cutaway(): AreaDef | null {
    const area = this.#playerArea ? this.layout.area(this.#playerArea) : undefined;
    return area?.interior ? area : null;
  }

  /** Whether a tile on a level is cut away for the current interior (fade it, don't let it be picked). */
  isCutAway(level: string, tileX: number, tileY: number): boolean {
    return this.#cutAwayTileKeys.has(`${level}:${tileX},${tileY}`);
  }

  #trackPlayerArea(runEnterHandler: boolean): void {
    if (!this.#grid.hasCharacter(this.player)) return;
    const areaId = this.areaOf(this.player)?.id ?? null;
    if (areaId === this.#playerArea) return;
    const previous = this.#playerArea;
    this.#playerArea = areaId;
    this.#cutAwayTileKeys = this.#computeCutAway();
    const area = areaId ? this.layout.area(areaId) : undefined;
    if (area) this.revealArea(area.id);
    this.events.emit("areaChanged", { area: areaId, previous });
    if (runEnterHandler && area?.onEnter)
      void this.runHandler(area.onEnter, { world: this, target: area.id, verb: "enter" });
  }

  /**
   * What covers the interior the player is in: wall tiles in front of it on screen
   * (the ones that would hide it), and everything on higher levels above it or
   * above those walls.
   */
  #computeCutAway(): Set<string> {
    const cutAwayTileKeys = new Set<string>();
    const interior = this.cutaway();
    if (!interior) return cutAwayTileKeys;
    const interiorTiles = this.layout.areaTiles(interior.id);
    const interiorTileKeys = new Set(interiorTiles.map((tile) => `${tile.level}:${tile.x},${tile.y}`));
    const footprint: { x: number; y: number; elevation: number }[] = [];
    const maximumSidewaysOffset = this.room.tile.width * 0.75;

    for (const interiorTile of interiorTiles) {
      const elevation = this.layout.level(interiorTile.level).elevation;
      footprint.push({ x: interiorTile.x, y: interiorTile.y, elevation });
      const interiorPoint = this.projection.tileToScreen(interiorTile.x, interiorTile.y);
      for (const [offsetX, offsetY] of NEIGHBOURS) {
        const neighbour = { x: interiorTile.x + offsetX, y: interiorTile.y + offsetY };
        if (interiorTileKeys.has(`${interiorTile.level}:${neighbour.x},${neighbour.y}`)) continue;
        if (this.layout.walkable(interiorTile.level, neighbour.x, neighbour.y)) continue;
        const neighbourPoint = this.projection.tileToScreen(neighbour.x, neighbour.y);
        // Everything above the room's walls goes; of the walls themselves, only those in front.
        footprint.push({ ...neighbour, elevation });
        const isInFrontOnScreen =
          neighbourPoint.y > interiorPoint.y && Math.abs(neighbourPoint.x - interiorPoint.x) < maximumSidewaysOffset;
        if (isInFrontOnScreen) cutAwayTileKeys.add(`${interiorTile.level}:${neighbour.x},${neighbour.y}`);
      }
    }
    for (const level of this.layout.levels)
      for (const footprintTile of footprint)
        if (level.elevation > footprintTile.elevation) cutAwayTileKeys.add(`${level.id}:${footprintTile.x},${footprintTile.y}`);

    // Anything else standing in front of the interior on screen hides it too: a balcony
    // over its doorway, the wall of the next room along, furniture. Cut any tile in front
    // of (or level with) an interior tile whose wall top, wall middle or raised floor lands
    // in the column of space above that interior tile.
    const wallHeight = this.room.wallHeight ?? this.room.tile.height;
    const highestElevation = Math.max(...this.layout.levels.map((level) => level.elevation));
    const interiorColumns = interiorTiles.map((interiorTile) => {
      const elevation = this.layout.level(interiorTile.level).elevation;
      return {
        floorY: this.projection.tileToScreen(interiorTile.x, interiorTile.y).y,
        polygon: extrudeUpward(this.#floorOutline(interiorTile.x, interiorTile.y), highestElevation - elevation + wallHeight).map(
          (coordinate, index) => (index % 2 === 1 ? coordinate - elevation : coordinate),
        ),
      };
    });
    const lowestInteriorElevation = Math.min(...interiorTiles.map((tile) => this.layout.level(tile.level).elevation));
    for (const level of this.layout.levels) {
      if (level.elevation < lowestInteriorElevation) continue;
      level.rows.forEach((row, tileY) =>
        [...row].forEach((character, tileX) => {
          const tileKey = `${level.id}:${tileX},${tileY}`;
          if (interiorTileKeys.has(tileKey) || cutAwayTileKeys.has(tileKey)) return;
          const isFloor = this.layout.walkable(level.id, tileX, tileY);
          // On raised levels, anything but '.' and '#' is open air.
          const isSolid = !isFloor && (level.index === 0 || character === "#");
          if (!isFloor && !isSolid) return;
          if (isFloor && level.elevation === lowestInteriorElevation) return; // floor beside the room hides nothing
          const floorPoint = this.projection.tileToScreen(tileX, tileY);
          const floorElevation = this.layout.elevationAt(level.id, tileX, tileY);
          const samplePoints = isFloor
            ? [{ x: floorPoint.x, y: floorPoint.y - floorElevation }]
            : [
                { x: floorPoint.x, y: floorPoint.y - floorElevation - wallHeight },
                { x: floorPoint.x, y: floorPoint.y - floorElevation - wallHeight / 2 },
              ];
          const hidesInterior = interiorColumns.some(
            (column) =>
              floorPoint.y >= column.floorY && samplePoints.some((point) => pointInShape({ polygon: column.polygon }, point)),
          );
          if (hidesInterior) cutAwayTileKeys.add(tileKey);
        }),
      );
    }
    return cutAwayTileKeys;
  }

  /** A base-floor tile's outline in room pixels (diamond or square). */
  #floorOutline(tileX: number, tileY: number): Vec2[] {
    const corner = (cornerX: number, cornerY: number) => this.projection.tileToScreen(cornerX, cornerY);
    if (this.projection.kind === "isometric")
      return [corner(tileX - 0.5, tileY - 0.5), corner(tileX + 0.5, tileY - 0.5), corner(tileX + 0.5, tileY + 0.5), corner(tileX - 0.5, tileY + 0.5)];
    const topLeft = corner(tileX - 0.5, tileY - 0.5);
    const bottomRight = corner(tileX + 0.5, tileY + 0.5);
    return [topLeft, { x: bottomRight.x, y: topLeft.y }, bottomRight, { x: topLeft.x, y: bottomRight.y }];
  }

  /**
   * Hotspots that can be used right now: their `when` passes, and their stand tile
   * isn't hidden in fog or under a cut-away roof.
   */
  hotspots(): HotspotDef[] {
    return this.room.hotspots.filter((h) => {
      if (h.when && !h.when(this)) return false;
      if (!h.standAt) return true;
      const level = h.level ?? this.layout.baseLevel;
      const area = this.layout.areaAt(level, h.standAt.x, h.standAt.y);
      if (area && !this.isAreaRevealed(area.id)) return false;
      return !this.isCutAway(level, h.standAt.x, h.standAt.y);
    });
  }

  /**
   * The floor tile under a room-pixel point. In multi-level rooms the highest
   * visible floor wins: stair steps first, then levels from the top down, skipping
   * anything cut away or hidden in fog.
   */
  pickTile(p: Vec2): Required<LevelTilePos> {
    const isPickable = (level: string, tileX: number, tileY: number) => {
      if (!this.layout.walkable(level, tileX, tileY) || this.isCutAway(level, tileX, tileY)) return false;
      const area = this.layout.areaAt(level, tileX, tileY);
      return !area || this.isAreaRevealed(area.id);
    };
    if (this.layout.isMultiLevel) {
      const stepsFromTop = [...this.layout.steps].sort((first, second) => second.elevation - first.elevation);
      for (const step of stepsFromTop) {
        const tileUnderPoint = this.projection.screenToTile(p.x, p.y + step.elevation);
        if (tileUnderPoint.x === step.x && tileUnderPoint.y === step.y && isPickable(step.level, step.x, step.y))
          return { x: step.x, y: step.y, level: step.level };
      }
      for (const level of this.layout.levelsFromTop) {
        const tileUnderPoint = this.projection.screenToTile(p.x, p.y + level.elevation);
        if (isPickable(level.id, tileUnderPoint.x, tileUnderPoint.y)) return { ...tileUnderPoint, level: level.id };
      }
    }
    return { ...this.projection.screenToTile(p.x, p.y), level: this.layout.baseLevel };
  }

  /** What's under a room-pixel point: hotspot, then actor, then floor tile. */
  pick(p: Vec2): Target {
    const spots = this.hotspots()
      .filter((h) => pointInShape(h.shape, p))
      .sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
    if (spots[0]) return { kind: "hotspot", hotspot: spots[0] };
    const views = this.actorViews().reverse(); // front-most first
    for (const v of views) {
      if (v.id === this.player || !this.isActorShown(v)) continue;
      const actorDef = this.game.actors[v.id];
      const [w, h] = actorDef?.hitbox ?? [this.room.tile.width, actorDef?.height ?? this.room.tile.width * 2];
      if (p.x >= v.screen.x - w / 2 && p.x < v.screen.x + w / 2 && p.y >= v.screen.y - h && p.y < v.screen.y)
        return { kind: "actor", id: v.id };
    }
    return { kind: "tile", tile: this.pickTile(p) };
  }

  nameAt(p: Vec2): string | null {
    const t = this.pick(p);
    if (t.kind === "hotspot") return t.hotspot.name;
    if (t.kind === "actor") return this.game.actors[t.id]?.name ?? t.id;
    return null;
  }

  // ------------------------------------------------------------------- input

  /** Update the hover label for a room-pixel point. */
  hover(p: Vec2 | null): void {
    this.ui.set({ hover: p ? this.nameAt(p) : null });
  }

  setVerb(verb: VerbId): void {
    this.ui.set({ verb, heldItem: null });
  }

  holdItem(item: string | null): void {
    this.ui.set({ heldItem: item, verb: item ? "use" : "walk" });
  }

  /**
   * Primary input. Tap/click at a room-pixel point:
   * walk to floor, or walk-then-act on a hotspot/actor with the current verb
   * (or the target's default verb if the current verb is "walk").
   */
  async activate(p: Vec2, verbOverride?: VerbId): Promise<void> {
    if (this.ui.get().busy) return;
    const target = this.pick(p);
    if (target.kind === "tile") {
      if (this.ui.get().heldItem) this.holdItem(null);
      await this.walk(this.player, target.tile);
      return;
    }
    const id = target.kind === "hotspot" ? target.hotspot.id : target.id;
    const { verb, heldItem } = this.ui.get();
    await this.interact(id, verbOverride ?? (verb !== "walk" ? verb : this.defaultVerbFor(id)), heldItem ?? undefined);
  }

  /** The verb a plain tap/A-press uses on a hotspot or actor. */
  defaultVerbFor(id: string): VerbId {
    const hotspot = this.room.hotspots.find((h) => h.id === id);
    if (hotspot) return hotspot.default ?? this.game.defaultVerb ?? "look";
    return "talk";
  }

  // ------------------------------------------------------------ focus input

  /**
   * Interactable things near an actor, nearest first: visible hotspots, plus
   * other actors that have verbs. Distance is in room pixels from the actor's
   * foot point to the target (hotspot stand point or shape centre).
   */
  targetsNear(from = this.player, maxDistance = Infinity): { id: string; name: string; distance: number }[] {
    const origin = this.actorViews().find((v) => v.id === from)?.screen;
    if (!origin) return [];
    const out: { id: string; name: string; distance: number }[] = [];
    for (const h of this.hotspots()) {
      const c = shapeCenter(h.shape);
      const stand = h.standAt ? this.screenOf(h.standAt, h.level) : c;
      const distance = Math.min(Math.hypot(c.x - origin.x, c.y - origin.y), Math.hypot(stand.x - origin.x, stand.y - origin.y));
      out.push({ id: h.id, name: h.name, distance });
    }
    for (const v of this.actorViews()) {
      const def = this.game.actors[v.id];
      if (v.id === from || !def?.verbs || !this.isActorShown(v)) continue;
      out.push({ id: v.id, name: def.name, distance: Math.hypot(v.screen.x - origin.x, v.screen.y - origin.y) });
    }
    return out.filter((t) => t.distance <= maxDistance).sort((a, b) => a.distance - b.distance);
  }

  setFocus(id: string | null): void {
    this.ui.set({ focus: id });
  }

  /** Cycle focus through targetsNear(), nearest first. */
  focusNext(step = 1, maxDistance = Infinity): string | null {
    const ids = this.targetsNear(this.player, maxDistance).map((t) => t.id);
    if (!ids.length) {
      this.setFocus(null);
      return null;
    }
    const i = ids.indexOf(this.ui.get().focus ?? "");
    const next = ids[(i + step + ids.length) % ids.length]!;
    this.setFocus(next);
    return next;
  }

  /** Act on the focused target: its default verb, or the given one. */
  async activateFocus(verb?: VerbId): Promise<void> {
    const id = this.ui.get().focus;
    if (!id || this.ui.get().busy) return;
    const { heldItem } = this.ui.get();
    await this.interact(id, verb ?? this.defaultVerbFor(id), heldItem ?? undefined);
  }

  /** Move the highlighted choice (gamepad/keyboard). */
  moveChoice(delta: number): void {
    const { choices, choiceIndex } = this.ui.get();
    if (!choices.length) return;
    this.ui.set({ choiceIndex: (choiceIndex + delta + choices.length) % choices.length });
  }

  confirmChoice(): void {
    const { choices, choiceIndex } = this.ui.get();
    const c = choices[choiceIndex];
    if (c) this.choose(c.index);
  }

  /**
   * Walk one step in a screen-space direction (stick or d-pad), in any
   * projection: picks the walkable neighbour tile whose on-screen direction is
   * closest. On a stair end, the step onto the other level is a candidate too, and
   * screen positions include elevation, so pushing "up" a staircase climbs it.
   * Returns null if there's nowhere to go or the actor is mid-step.
   */
  stepToward(id: string, dir: Vec2): Promise<boolean> | null {
    const len = Math.hypot(dir.x, dir.y);
    if (!len || !this.#grid.hasCharacter(id) || this.#grid.isMoving(id) || this.#climbs.has(id)) return null;
    const from = this.tileOf(id);
    const fromLevel = this.levelOf(id);
    const origin = this.screenOf(from, fromLevel);
    const diagonals = (this.room.directions ?? 4) === 8;
    const candidates: Required<LevelTilePos>[] = [];
    for (const [dx, dy] of NEIGHBOURS) {
      if (!diagonals && dx !== 0 && dy !== 0) continue;
      const neighbour = { x: from.x + dx, y: from.y + dy };
      if (this.fits(id, neighbour, fromLevel) && !this.#grid.isBlocked(neighbour, fromLevel))
        candidates.push({ ...neighbour, level: fromLevel });
    }
    const otherEnd = this.#stairStepFrom(from, fromLevel);
    if (otherEnd && this.fits(id, otherEnd, otherEnd.level) && !this.#grid.isBlocked(otherEnd, otherEnd.level)) candidates.push(otherEnd);

    let best: { tile: Required<LevelTilePos>; score: number } | null = null;
    for (const tile of candidates) {
      const s = this.screenOf(tile, tile.level);
      const sx = s.x - origin.x;
      const sy = s.y - origin.y;
      const score = (sx * dir.x + sy * dir.y) / (Math.hypot(sx, sy) * len);
      if (score > 0.5 && (!best || score > best.score)) best = { tile, score };
    }
    if (!best) return null;
    if (best.tile.level !== fromLevel) {
      this.#walkTokenByActor.set(id, (this.#walkTokenByActor.get(id) ?? 0) + 1);
      return this.#climb(id, best.tile);
    }
    return this.walk(id, best.tile);
  }

  /** The tile at the other end of a stair step, if this tile is a stair's last step or landing. */
  #stairStepFrom(tile: TilePos, level: string): Required<LevelTilePos> | null {
    for (const stair of this.layout.stairEnds) {
      if (level === stair.fromLevel && tile.x === stair.lastStep.x && tile.y === stair.lastStep.y)
        return { ...stair.top, level: stair.toLevel };
      if (level === stair.toLevel && tile.x === stair.top.x && tile.y === stair.top.y)
        return { ...stair.lastStep, level: stair.fromLevel };
    }
    return null;
  }

  // ------------------------------------------------------------ interaction

  /** Walk to a target (if it has a stand point), face it, then run its handler. */
  async interact(targetId: string, verb: VerbId, item?: string): Promise<void> {
    const hotspot = this.room.hotspots.find((h) => h.id === targetId);
    const actor = this.game.actors[targetId];
    let handler: Handler | undefined;
    if (item) handler = this.game.items?.[item]?.with?.[targetId];
    handler ??= hotspot?.verbs[verb] ?? actor?.verbs?.[verb];

    await this.#busy(async () => {
      if (hotspot) {
        if (hotspot.standAt) await this.walk(this.player, hotspot.standAt);
        const c = shapeCenter(hotspot.shape);
        const center = this.projection.screenToTile(c.x, c.y);
        this.face(this.player, hotspot.face ?? facingToward(this.tileOf(this.player), center));
      } else if (actor) {
        const there = this.tileOf(targetId);
        // The actor occupies its tile, so CLOSEST_REACHABLE stops beside it.
        await this.walk(this.player, there);
        this.face(this.player, facingToward(this.tileOf(this.player), there));
        this.face(targetId, facingToward(there, this.tileOf(this.player)));
      }
      if (!handler) {
        const text = this.game.fallback?.(verb, targetId) ?? "I can't do that.";
        await this.say(this.player, text);
        return;
      }
      await this.runHandler(handler, { world: this, target: targetId, verb, ...(item ? { item } : {}) });
      if (item) this.holdItem(null);
    });
  }

  async runHandler(handler: Handler, ctx: ScriptContext): Promise<void> {
    try {
      if (typeof handler === "function") return await handler(ctx);
      if (!this.#runner) throw new Error(`no script runner installed for "${handler}"`);
      await this.#runner.run(handler, ctx);
    } catch (error) {
      this.events.emit("error", { error, context: `${ctx.verb} ${ctx.target}` });
    }
  }

  /** Run one command line (`walk hero 3 4`, `say moth "hi"`). Leading `>>>` is optional. */
  async command(line: string): Promise<void> {
    const [name, ...args] = tokenize(line.replace(/^\s*>>>\s*/, ""));
    if (!name) return;
    const fn = this.commands.get(name);
    if (!fn) throw new Error(`unknown command "${name}"`);
    await fn(args, this);
  }

  // ---------------------------------------------------------------- actions

  /**
   * Pathfind to a tile; resolves true if the actor got there, false if it stopped short.
   * In a multi-level room, `dest.level` picks the floor; without it, the actor's own
   * level is used when the tile is walkable there, else the lowest level where it is.
   * Reaching another level walks to the nearest stairs, climbs (or descends) them,
   * and carries on, as many times as it takes. A newer walk cancels the rest of the route.
   */
  walk(id: string, dest: LevelTilePos): Promise<boolean> {
    if (!this.#grid.hasCharacter(id)) return Promise.resolve(false);
    const walkToken = (this.#walkTokenByActor.get(id) ?? 0) + 1;
    this.#walkTokenByActor.set(id, walkToken);
    const fromLevel = this.levelOf(id);
    const destLevel = this.#levelForDestination(dest, fromLevel);
    this.events.emit("walk", { actor: id, to: { x: dest.x, y: dest.y, level: destLevel } });
    this.#walkDestinationByActor.set(id, { x: dest.x, y: dest.y, level: destLevel });
    const attempt = (): Promise<boolean> => {
      const walkabilityWhenStarted = this.#walkabilityGeneration;
      // The common case starts moving right away, so callers can step time immediately.
      const walking =
        this.levelOf(id) === destLevel && !this.#climbs.has(id)
          ? this.#walkOnLevel(id, dest, destLevel)
          : this.#walkAcrossLevels(id, dest, destLevel, walkToken);
      return walking.then((arrived) => {
        const isCurrent = this.#walkTokenByActor.get(id) === walkToken;
        // A door shut (or opened) on the way: plan again from here, same promise for the caller.
        if (!arrived && isCurrent && this.#walkabilityGeneration !== walkabilityWhenStarted) return attempt();
        if (isCurrent) this.#walkDestinationByActor.delete(id);
        return arrived;
      });
    };
    return attempt();
  }

  async #walkAcrossLevels(id: string, dest: TilePos, destLevel: string, walkToken: number): Promise<boolean> {
    const isCurrent = () => this.#walkTokenByActor.get(id) === walkToken;
    await this.#climbs.get(id)?.finished;
    while (isCurrent() && this.levelOf(id) !== destLevel) {
      const stair = this.#nextStairToward(id, destLevel);
      if (!stair) return false;
      const arrivedAtStair = await this.#walkOnLevel(id, stair.near, this.levelOf(id));
      if (!arrivedAtStair || !isCurrent()) return false;
      const climbed = await this.#climb(id, stair.far);
      if (!climbed) return false;
    }
    if (!isCurrent()) return false;
    return this.#walkOnLevel(id, dest, destLevel);
  }

  /**
   * The stair end to head for next: the first hop on the shortest chain of stairs
   * (by number of hops) to the destination level, and among stairs that make that
   * hop, the one reachable by the shortest walk.
   */
  #nextStairToward(id: string, destLevel: string): { near: TilePos; far: Required<LevelTilePos> } | null {
    const currentLevel = this.levelOf(id);
    const nextLevel = this.#nextLevelOnRoute(currentLevel, destLevel);
    if (!nextLevel) return null;
    const from = this.tileOf(id);
    const options: { near: TilePos; far: Required<LevelTilePos>; distance: number }[] = [];
    for (const stair of this.layout.stairEnds) {
      let near: TilePos;
      let far: Required<LevelTilePos>;
      if (stair.fromLevel === currentLevel && stair.toLevel === nextLevel) {
        near = stair.lastStep;
        far = { ...stair.top, level: stair.toLevel };
      } else if (stair.toLevel === currentLevel && stair.fromLevel === nextLevel) {
        near = stair.top;
        far = { ...stair.lastStep, level: stair.fromLevel };
      } else continue;
      if (!this.fits(id, near, currentLevel) || !this.fits(id, far, far.level)) continue;
      const path = this.#grid.findShortestPath(
        { position: from, charLayer: currentLevel },
        { position: near, charLayer: currentLevel },
        {
          numberOfDirections: (this.room.directions ?? 4) as unknown as NumberOfDirections,
          ignoredChars: [id],
          isPositionAllowed: (position, charLayer) => this.fits(id, position, charLayer ?? currentLevel),
        },
      ).path;
      const reachable = path.length > 0 || (from.x === near.x && from.y === near.y);
      if (reachable) options.push({ near, far, distance: path.length });
    }
    options.sort((first, second) => first.distance - second.distance);
    return options[0] ?? null;
  }

  /** Breadth-first over the stair graph: which level to climb or descend to next. */
  #nextLevelOnRoute(fromLevel: string, destLevel: string): string | null {
    const firstHopByLevel = new Map<string, string>();
    const levelsToVisit = [fromLevel];
    const visitedLevels = new Set([fromLevel]);
    while (levelsToVisit.length) {
      const level = levelsToVisit.shift()!;
      for (const stair of this.layout.stairEnds) {
        const neighbourLevel = stair.fromLevel === level ? stair.toLevel : stair.toLevel === level ? stair.fromLevel : null;
        if (!neighbourLevel || visitedLevels.has(neighbourLevel)) continue;
        visitedLevels.add(neighbourLevel);
        firstHopByLevel.set(neighbourLevel, firstHopByLevel.get(level) ?? neighbourLevel);
        if (neighbourLevel === destLevel) return firstHopByLevel.get(neighbourLevel)!;
        levelsToVisit.push(neighbourLevel);
      }
    }
    return null;
  }

  /**
   * The one step between a stair's last step and its landing, which changes level.
   * Animated by the World (grid-engine only moves within a level), at the actor's speed.
   */
  #climb(id: string, to: Required<LevelTilePos>): Promise<boolean> {
    if (this.#grid.isBlocked(to, to.level) || !this.fits(id, to, to.level)) return Promise.resolve(false);
    const from = this.tileOf(id);
    const fromLevel = this.levelOf(id);
    const durationMs = 1000 / (this.game.actors[id]?.speed ?? 4);
    this.face(id, facingOfStep(to.x - from.x, to.y - from.y));
    this.#grid.setPosition(id, { x: to.x, y: to.y }, to.level);
    this.#syncActor(id);
    const finished = this.wait(durationMs).then(() => {
      this.#climbs.delete(id);
      return true;
    });
    this.#climbs.set(id, { from, to, fromLevel, toLevel: to.level, startedAt: this.#time, durationMs, finished });
    return finished;
  }

  /** Pathfind within one level. */
  #walkOnLevel(id: string, dest: TilePos, level: string): Promise<boolean> {
    const from = this.tileOf(id);
    if (from.x === dest.x && from.y === dest.y && this.levelOf(id) === level) return Promise.resolve(true);
    // Walking "to" an occupied tile (an NPC, a prop) means walking next to it. If we're
    // already beside it there's nothing to do; grid-engine would otherwise never finish.
    let to: TilePos = { x: dest.x, y: dest.y };
    if (this.#grid.isBlocked(to, level)) {
      if (this.#adjacent(from, to)) return Promise.resolve(false);
      const beside = this.#freeNeighbours(to, level, id).sort(
        (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
      )[0];
      if (beside) to = beside;
    }
    // Nowhere nearer to go (the target is cut off and we're already as close as we can get):
    // grid-engine would wait forever for a move it never starts, so answer now.
    const plannedRoute = this.#grid.findShortestPath(
      { position: from, charLayer: level },
      { position: to, charLayer: level },
      {
        numberOfDirections: (this.room.directions ?? 4) as unknown as NumberOfDirections,
        ignoredChars: [id],
        calculateClosestToTarget: true,
        isPositionAllowed: (position, charLayer) => this.fits(id, position, charLayer ?? level),
      },
    );
    const closest = plannedRoute.closestToTarget?.position;
    if (!plannedRoute.path.length && (!closest || (closest.x === from.x && closest.y === from.y))) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const sub = this.#grid
        .moveTo(id, to, {
          noPathFoundStrategy: NoPathFoundStrategy.CLOSEST_REACHABLE,
          // Default fires when the last step *starts*; we want arrival.
          emitFinishedEvent: "END_MOVEMENT",
          // Too tall for the ceiling there? Then that tile isn't on this actor's map.
          isPositionAllowedFn: (position, charLayer) => this.fits(id, position, charLayer ?? level),
        })
        .subscribe(() => {
          if (settled) return;
          settled = true;
          // May fire synchronously (no path), before `sub` is assigned.
          queueMicrotask(() => sub.unsubscribe());
          const at = this.#grid.getPosition(id);
          this.#syncActor(id);
          // grid-engine reports "SUCCESS" on reaching the closest reachable tile too,
          // so arrival is judged by where the actor actually ended up.
          resolve(at.x === to.x && at.y === to.y);
        });
    });
  }

  #levelForDestination(dest: LevelTilePos, currentLevel: string): string {
    if (dest.level) {
      if (!this.layout.hasLevel(dest.level)) throw new Error(`room "${this.room.id}" has no level "${dest.level}"`);
      return dest.level;
    }
    if (this.layout.walkable(currentLevel, dest.x, dest.y)) return currentLevel;
    return this.layout.levels.find((level) => this.layout.walkable(level.id, dest.x, dest.y))?.id ?? currentLevel;
  }

  /** Add an actor at runtime (remote players, spawned NPCs). */
  addActor(id: string, def: import("./types").ActorDef, at: ActorPlacement, room = this.room.id): void {
    this.game.actors[id] = def;
    this.state.actors[id] = {
      room,
      x: at.at.x,
      y: at.at.y,
      facing: at.facing ?? "down",
      visible: true,
      ...(at.level ? { level: at.level } : {}),
    };
    if (room === this.room.id && !this.#grid.hasCharacter(id)) {
      this.#grid.addCharacter({
        id,
        charLayer: this.levelOf(id),
        startPosition: at.at,
        facingDirection: (at.facing ?? "down") as unknown as Direction,
        speed: def.speed ?? 4,
      });
    }
    this.events.emit("actorAdded", { actor: id });
  }

  removeActor(id: string): void {
    if (this.#grid.hasCharacter(id)) this.#grid.removeCharacter(id);
    delete this.state.actors[id];
    this.events.emit("actorRemoved", { actor: id });
  }

  #adjacent(a: TilePos, b: TilePos): boolean {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return (this.room.directions ?? 4) === 8 ? Math.max(dx, dy) === 1 : dx + dy === 1;
  }

  #freeNeighbours(t: TilePos, level: string, id: string): TilePos[] {
    const diagonals = (this.room.directions ?? 4) === 8;
    return NEIGHBOURS.filter(([dx, dy]) => diagonals || dx === 0 || dy === 0)
      .map(([dx, dy]) => ({ x: t.x + dx, y: t.y + dy }))
      .filter((n) => this.fits(id, n, level) && !this.#grid.isBlocked(n, level));
  }

  face(id: string, facing: Facing): void {
    const a = this.state.actors[id];
    if (a) a.facing = facing;
  }

  /** Put an actor on a tile instantly. `at.level` moves it between floors; omitted, it stays on its own. */
  place(id: string, at: LevelTilePos): void {
    const a = this.#actor(id);
    const level = at.level ?? (a.room === this.room.id ? this.levelOf(id) : a.level);
    a.x = at.x;
    a.y = at.y;
    if (level) a.level = level;
    if (this.#grid.hasCharacter(id)) this.#grid.setPosition(id, { x: at.x, y: at.y }, level ?? this.layout.baseLevel);
    if (id === this.player) this.#trackPlayerArea(false);
  }

  setVisible(id: string, visible: boolean): void {
    this.#actor(id).visible = visible;
  }

  /** Show a line and wait for the UI (or autoAdvanceMs) to advance it. */
  say(speaker: string | null, text: string, tags: string[] = []): Promise<void> {
    this.ui.set({ line: { speaker, text, tags }, choices: [] });
    return new Promise<void>((resolve) => {
      this.#lineResolve = () => {
        this.#lineResolve = null;
        this.ui.set({ line: null });
        resolve();
      };
      if (this.options.autoAdvanceMs !== undefined)
        void this.wait(this.options.autoAdvanceMs).then(() => this.#lineResolve?.());
    });
  }

  /** UI calls this on tap/click/key while a line is showing. */
  advance(): void {
    this.#lineResolve?.();
  }

  /** Offer choices and wait for choose(). */
  ask(choices: DialogChoice[]): Promise<number> {
    this.ui.set({ choices, line: null, choiceIndex: 0 });
    return new Promise<number>((resolve) => {
      this.#choiceResolve = (i) => {
        this.#choiceResolve = null;
        this.ui.set({ choices: [] });
        resolve(i);
      };
    });
  }

  choose(index: number): void {
    this.#choiceResolve?.(index);
  }

  /** Resolve after ms of world time (not wall time), so servers and tests stay deterministic. */
  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.#timers.push({ at: this.#time + ms, resolve }));
  }

  async goto(roomId: string, entry?: string): Promise<void> {
    const room = this.game.rooms[roomId];
    if (!room) throw new Error(`unknown room "${roomId}"`);
    this.#leave();
    const p = World.entryFor(room, entry);
    const player = this.#actor(this.player);
    Object.assign(player, { room: roomId, x: p.at.x, y: p.at.y, facing: p.facing ?? player.facing });
    if (p.level) player.level = p.level;
    else delete player.level;
    this.state.room = roomId;
    this.#enter(roomId);
    if (room.onEnter) await this.runHandler(room.onEnter, { world: this, target: roomId, verb: "enter" });
  }

  give(item: string): void {
    if (!this.state.inventory.includes(item)) this.state.inventory = [...this.state.inventory, item];
    this.ui.set({ inventory: this.state.inventory });
  }

  take(item: string): void {
    this.state.inventory = this.state.inventory.filter((i) => i !== item);
    this.ui.set({ inventory: this.state.inventory });
  }

  has(item: string): boolean {
    return this.state.inventory.includes(item);
  }

  flag(name: string): FlagValue | undefined {
    return this.state.flags[name];
  }

  setFlag(name: string, value: FlagValue): void {
    if (this.state.flags[name] === value) return;
    this.state.flags[name] = value;
    this.events.emit("flag", { name, value });
  }

  // ------------------------------------------------------------- save/load

  serialize(): WorldState {
    for (const id of this.actorsInRoom()) this.#syncActor(id);
    const script = this.#runner?.save?.();
    return structuredClone({ ...this.state, ...(script !== undefined ? { script } : {}) });
  }

  load(state: WorldState): void {
    this.state = structuredClone(state);
    if (state.script !== undefined) this.#runner?.load?.(state.script);
    this.#enter(state.room);
  }

  // ---------------------------------------------------------------- private

  #actor(id: string): ActorState {
    const a = this.state.actors[id];
    if (!a) throw new Error(`unknown actor "${id}"`);
    return a;
  }

  #syncActor(id: string): void {
    if (!this.#grid.hasCharacter(id)) return;
    const a = this.#actor(id);
    const p = this.#grid.getPosition(id);
    a.x = p.x;
    a.y = p.y;
    const level = this.#grid.getCharLayer(id);
    if (level && this.layout.isMultiLevel) a.level = level;
  }

  #leave(): void {
    if (!this.room) return;
    for (const id of this.actorsInRoom()) this.#syncActor(id);
  }

  #enter(roomId: string): void {
    const room = this.game.rooms[roomId];
    if (!room) throw new Error(`unknown room "${roomId}"`);
    this.room = room;
    this.projection = projectionFor(room);
    const { tilemap, walkmap, layout } = tilemapFor(room);
    this.walkmap = walkmap;
    this.layout = layout;
    this.#changedTileKeys = new Set();
    this.#walkDestinationByActor.clear();
    this.#grid = new GridEngineHeadless(false);
    this.#grid.create(tilemap, {
      characters: this.actorsInRoom().map((id) => {
        const a = this.#actor(id);
        return {
          id,
          charLayer: a.level && layout.hasLevel(a.level) ? a.level : layout.baseLevel,
          startPosition: { x: a.x, y: a.y },
          facingDirection: a.facing as unknown as Direction,
          speed: this.game.actors[id]?.speed ?? 4,
        };
      }),
      numberOfDirections: (room.directions ?? 4) as unknown as NumberOfDirections,
    });
    // Track each step ourselves: where it starts and ends, and which way that faces in grid space.
    this.#steps.clear();
    this.#climbs.clear();
    const grid = this.#grid;
    grid.positionChangeStarted().subscribe(({ charId, exitTile, enterTile, exitLayer, enterLayer }) => {
      if (grid !== this.#grid) return;
      this.#steps.set(charId, {
        from: { x: exitTile.x, y: exitTile.y },
        to: { x: enterTile.x, y: enterTile.y },
        fromLevel: exitLayer ?? layout.baseLevel,
        toLevel: enterLayer ?? layout.baseLevel,
      });
      const a = this.state.actors[charId];
      if (a) a.facing = facingOfStep(enterTile.x - exitTile.x, enterTile.y - exitTile.y);
    });
    grid.positionChangeFinished().subscribe(({ charId }) => {
      if (grid === this.#grid) this.#steps.delete(charId);
    });
    this.ui.set({ room: roomId, inventory: this.state.inventory, hover: null, focus: null });
    this.#playerArea = null;
    this.#cutAwayTileKeys = new Set();
    this.#applyWalkability(true);
    this.events.emit("roomChanged", { room, projection: this.projection });
    // Arriving inside an area reveals it, but its onEnter is left to the room's own onEnter.
    this.#trackPlayerArea(false);
    if (room.music) this.events.emit("music", { key: room.music });
  }

  async #busy(fn: () => Promise<void>): Promise<void> {
    this.ui.set({ busy: true });
    try {
      await fn();
    } finally {
      this.ui.set({ busy: false, line: null, choices: [] });
    }
  }

  /** Verbs offered by the UI. */
  get verbs(): VerbId[] {
    return this.game.verbs ?? DEFAULT_VERBS;
  }
}

/**
 * A floor outline swept straight up by `height` pixels, as a flat polygon: the
 * screen region a column of that height standing on the outline covers.
 */
function extrudeUpward(outline: Vec2[], height: number): number[] {
  const raised = outline.map((point) => ({ x: point.x, y: point.y - height }));
  // Convex hull of the outline and its raised copy, by gift wrapping (eight points at most).
  const points = [...outline, ...raised];
  const hull: Vec2[] = [];
  let current = points.reduce((leftmost, point) => (point.x < leftmost.x || (point.x === leftmost.x && point.y < leftmost.y) ? point : leftmost));
  do {
    hull.push(current);
    let candidate = points[0]!;
    for (const point of points) {
      if (candidate === current) {
        candidate = point;
        continue;
      }
      const cross = (candidate.x - current.x) * (point.y - current.y) - (candidate.y - current.y) * (point.x - current.x);
      if (cross < 0 || (cross === 0 && Math.hypot(point.x - current.x, point.y - current.y) > Math.hypot(candidate.x - current.x, candidate.y - current.y)))
        candidate = point;
    }
    current = candidate;
  } while (current !== hull[0] && hull.length <= points.length);
  return hull.flatMap((point) => [point.x, point.y]);
}
