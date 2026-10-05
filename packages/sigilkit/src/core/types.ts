/** A point in room pixel space, or a fractional tile position. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Integer tile coordinates on a room's walk grid. */
export type TilePos = Vec2;

/** A tile on a particular level of a multi-level room. Omitted `level` means the room's base level. */
export interface LevelTilePos extends TilePos {
  level?: string;
}

export type Facing =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

export type VerbId = string;
export type FlagValue = string | number | boolean;

export const DEFAULT_VERBS: VerbId[] = ["walk", "look", "use", "talk", "take"];

/**
 * What runs when a verb is used on something.
 * - string: a story path handed to the installed script runner (an Ink knot with sigilkit/story)
 * - function: TypeScript, for anything the story layer shouldn't own
 */
export type Handler = string | ((ctx: ScriptContext) => void | Promise<void>);

export interface ScriptContext {
  world: import("./world").World;
  /** The hotspot, actor or item that was acted on. */
  target: string;
  verb: VerbId;
  /** Item used on the target, for "use X with Y". */
  item?: string;
}

export type Shape =
  | { rect: [x: number, y: number, w: number, h: number] }
  | { polygon: number[] };

export interface HotspotDef {
  id: string;
  /** Shown on hover and in the verb line ("Look at <name>"). */
  name: string;
  /** Room pixel space, so it lines up with painted backgrounds in either projection. */
  shape: Shape;
  /** Tile the player walks to before acting. Omit to act from where they stand. */
  standAt?: TilePos;
  face?: Facing;
  /** Verb used on tap/left-click. Falls back to the game's defaultVerb. */
  default?: VerbId;
  verbs: Record<VerbId, Handler>;
  /** Hide the hotspot unless this returns true. */
  when?: (world: import("./world").World) => boolean;
  /** Higher wins when shapes overlap. */
  z?: number;
  /** Level of `standAt` in a multi-level room. Default: the base level. */
  level?: string;
}

export interface ActorDef {
  name: string;
  /** Asset key the renderer resolves to a spritesheet. */
  sprite: string;
  /** Tiles per second. */
  speed?: number;
  /** Dialog text color hint for the UI. */
  color?: string;
  /** Verbs used directly on this actor (talk, look...). */
  verbs?: Record<VerbId, Handler>;
  /** Pick box above the foot point, in pixels. Defaults to one tile wide and `height` tall (two tiles tall without one). */
  hitbox?: [width: number, height: number];
  /**
   * How tall the character stands, in screen pixels (the same units as level
   * elevations and wall heights). It won't walk, step or climb anywhere the
   * clearance overhead is lower. Default: two tile heights ("two blocks").
   */
  height?: number;
}

export interface ActorPlacement {
  at: TilePos;
  facing?: Facing;
  /** Level in a multi-level room. Default: the base level. */
  level?: string;
}

/**
 * A floor stacked above the room's base walkmap: a balcony, an upper storey, a roof.
 * Same grid size and legend as `RoomDef.walkmap`, except that on a raised level any
 * character other than '.' and '#' is open air (nothing is drawn there).
 */
export interface LevelDef {
  id: string;
  /** How many pixels this floor sits above the base floor, on screen. */
  elevation: number;
  walkmap: string[];
  /** Area letters for this level's tiles (see `RoomDef.areas`). */
  areamap?: string[];
}

/**
 * Stairs or a ramp from one level up to another. The art decides which it looks like;
 * the engine only needs the steps. Chain several to climb more than one level.
 * Actors change level only by stepping between the last step and `top`, so a floor
 * passing under or beside the stairs never catches anyone.
 */
export interface StairDef {
  /** Lower level. Default: the base level. */
  from?: string;
  /** Upper level. */
  to: string;
  /**
   * Step tiles, bottom to top, on the lower level. They're made walkable there, and
   * rise evenly from the lower level's elevation toward the upper one's.
   */
  steps: TilePos[];
  /** Landing on the upper level: walkable there, and next to the last step. */
  top: TilePos;
}

/**
 * Low headroom over particular tiles: a one-block doorway, a crawlspace, a vent.
 * Clearance under raised levels (a balcony, an upper floor) is worked out
 * automatically; this is for openings the levels don't describe.
 */
export interface ClearanceDef {
  /** Level the tiles are on. Default: the base level. */
  level?: string;
  tiles: TilePos[];
  /** Pixels of headroom above the floor there. */
  height: number;
}

/**
 * A named region of tiles: a building's interior, one room of a house, a cave.
 * Tiles join an area through `areamap` (base level) or `LevelDef.areamap`, using `key`.
 */
export interface AreaDef {
  id: string;
  /** Single character used for this area in areamaps. */
  key: string;
  name?: string;
  /**
   * Cutaway: while the player stands in this area, whatever is in front of or
   * above it (front walls, upper floors, a roof, `cover` props) fades away and
   * everything outside it is shaded.
   */
  interior?: boolean;
  /**
   * When the area's contents can be seen.
   * - "always" (default)
   * - "once": hidden under fog until the player first enters it; saved
   * - "inside": hidden except while the player is in it
   */
  reveal?: "always" | "once" | "inside";
  /** Ids of props that cover this area (painted roofs, front walls): faded during cutaway. */
  cover?: string[];
  /** Runs each time the player walks in (an Ink knot or a function). */
  onEnter?: Handler;
}

export type ProjectionKind = "orthogonal" | "isometric";

export interface RoomDef {
  id: string;
  projection: ProjectionKind;
  /** Tile footprint in pixels. Isometric tiles are usually 2:1 (e.g. 32x16). */
  tile: { width: number; height: number };
  /**
   * Walk grid, one string per row. '.' walkable, anything else blocked.
   * By convention '#' is wall (the blockout renderer raises it in isometric
   * rooms) and other characters are blocked floor under furniture.
   * SCUMM-style rooms paint the art separately and use this only for walkability.
   */
  walkmap: string[];
  /** Pixel offset of tile (0,0)'s reference corner inside the room art. */
  origin?: Vec2;
  /**
   * How tall the blockout draws this room's walls, overriding the renderer's
   * `blockout.wallHeight`. Set it to the roof's elevation so walls meet the roof.
   */
  wallHeight?: number;
  /** Id of the base level (the `walkmap` above). Default "ground". */
  baseLevel?: string;
  /** Floors above the base walkmap, connected by `stairs`. */
  levels?: LevelDef[];
  stairs?: StairDef[];
  /** Area letters for the base level's tiles, one string per row like `walkmap`. Spaces and '.' mean no area. */
  areamap?: string[];
  areas?: AreaDef[];
  /** Low openings: tiles with less headroom than the levels alone give them. */
  clearances?: ClearanceDef[];
  /**
   * Movement directions. 8 allows diagonal steps, which makes stick control in
   * isometric rooms feel right (screen-up is a grid diagonal). Default 4.
   */
  directions?: 4 | 8;
  /** Room size in pixels; defaults to the background size or the grid's bounds. */
  size?: { width: number; height: number };
  background?: string;
  /** Scenery that depth-sorts with actors: static art, or animated displays from the renderer's prop factory. */
  props?: PropDef[];
  hotspots: HotspotDef[];
  actors?: Record<string, ActorPlacement>;
  /** Named arrival points for goto(room, entry). */
  entries?: Record<string, ActorPlacement>;
  music?: string;
  onEnter?: Handler;
}

export interface PropDef {
  /** Lets a prop factory (or game code) recognise this prop. */
  id?: string;
  /** Static art. Optional when a prop factory draws it. */
  asset?: string;
  /** Top-left in room pixels (static art), or... */
  at?: Vec2;
  /** ...the tile it stands on; drawn at that tile's foot point. */
  tile?: TilePos;
  /** Tile used for depth sorting; defaults to `tile`, or the art's bottom edge. */
  depthTile?: TilePos;
  /**
   * Which point of the static art sits on the placement point, as fractions of
   * its width and height. Defaults to bottom-centre `{ x: 0.5, y: 1 }` for
   * `tile` and top-left `{ x: 0, y: 0 }` for `at`. An isometric block whose
   * floor diamond extends below the tile centre uses
   * `{ x: 0.5, y: (wallHeight + tileHeight / 2) / (wallHeight + tileHeight) }`.
   */
  anchor?: Vec2;
  /** Level a `tile`-placed prop stands on in a multi-level room: raised by its elevation, sorted with it. */
  level?: string;
}

export interface ItemDef {
  name: string;
  icon: string;
  verbs?: Record<VerbId, Handler>;
  /** "use this with <otherItemOrHotspot>" handlers. */
  with?: Record<string, Handler>;
}

export interface GameDef {
  title: string;
  /** Logical render size. The renderer scales this to fit any screen. */
  resolution: { width: number; height: number };
  player: string;
  startRoom: string;
  startEntry?: string;
  actors: Record<string, ActorDef>;
  rooms: Record<string, RoomDef>;
  items?: Record<string, ItemDef>;
  verbs?: VerbId[];
  defaultVerb?: VerbId;
  flags?: Record<string, FlagValue>;
  /** Line the player says when a verb has no handler. */
  fallback?: (verb: VerbId, target: string) => string;
}

export interface ActorState {
  room: string | null;
  x: number;
  y: number;
  facing: Facing;
  visible: boolean;
  /** Level in a multi-level room; absent means the base level. */
  level?: string;
}

/** Everything needed to save, load, or sync a game. Plain JSON. */
export interface WorldState {
  room: string;
  actors: Record<string, ActorState>;
  inventory: string[];
  flags: Record<string, FlagValue>;
  /** Opaque blob owned by the script runner (Ink state JSON). */
  script?: string;
  /** Areas revealed by entering them (`reveal: "once"`), as "roomId:areaId". */
  revealed?: string[];
}

export interface DialogLine {
  speaker: string | null;
  text: string;
  tags: string[];
}

export interface DialogChoice {
  index: number;
  text: string;
}

/** Transient UI state, read by React through useSyncExternalStore. */
export interface UiState {
  line: DialogLine | null;
  choices: DialogChoice[];
  verb: VerbId;
  heldItem: string | null;
  hover: string | null;
  /** True while a script runs; input to the world is ignored. */
  busy: boolean;
  /** Hotspot or actor targeted by non-pointer input (gamepad, keyboard). */
  focus: string | null;
  /** Highlighted choice for non-pointer input. */
  choiceIndex: number;
  inventory: string[];
  room: string;
}

/** Rendering-facing view of one actor, already projected to room pixels. */
export interface ActorView {
  id: string;
  sprite: string;
  screen: Vec2;
  depth: number;
  /** Facing in grid space (what scripts and `face` use). */
  facing: Facing;
  /** The same facing as it appears on screen; pick sprite rows from this. Differs from `facing` in isometric rooms. */
  screenFacing: Facing;
  moving: boolean;
  visible: boolean;
  /** Level the actor is on (the base level's id in single-level rooms). */
  level: string;
  /** Pixels the actor is raised by its level or the stair step it's on; already applied to `screen`. */
  elevation: number;
  /** Draw-order key: the foot point's y on the base floor, nudged by elevation. Larger draws in front. */
  sortY: number;
  /** Area the actor stands in, if any. */
  area: string | null;
}
