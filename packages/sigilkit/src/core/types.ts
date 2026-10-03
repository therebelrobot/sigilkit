/** A point in room pixel space, or a fractional tile position. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Integer tile coordinates on a room's walk grid. */
export type TilePos = Vec2;

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
  /** Pick box above the foot point, in pixels. Defaults to one tile wide, two tall. */
  hitbox?: [width: number, height: number];
}

export interface ActorPlacement {
  at: TilePos;
  facing?: Facing;
}

export type ProjectionKind = "orthogonal" | "isometric";

export interface RoomDef {
  id: string;
  projection: ProjectionKind;
  /** Tile footprint in pixels. Isometric tiles are usually 2:1 (e.g. 32x16). */
  tile: { width: number; height: number };
  /**
   * Walk grid, one string per row. '.' walkable, anything else blocked.
   * SCUMM-style rooms paint the art separately and use this only for walkability.
   */
  walkmap: string[];
  /** Pixel offset of tile (0,0)'s reference corner inside the room art. */
  origin?: Vec2;
  /** Room size in pixels; defaults to the background size or the grid's bounds. */
  size?: { width: number; height: number };
  background?: string;
  /** Art drawn over actors (pillars, foliage) that should still depth-sort. */
  props?: { asset: string; at: Vec2; depthTile?: TilePos }[];
  hotspots: HotspotDef[];
  actors?: Record<string, ActorPlacement>;
  /** Named arrival points for goto(room, entry). */
  entries?: Record<string, ActorPlacement>;
  music?: string;
  onEnter?: Handler;
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
}

/** Everything needed to save, load, or sync a game. Plain JSON. */
export interface WorldState {
  room: string;
  actors: Record<string, ActorState>;
  inventory: string[];
  flags: Record<string, FlagValue>;
  /** Opaque blob owned by the script runner (Ink state JSON). */
  script?: string;
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
  inventory: string[];
  room: string;
}

/** Rendering-facing view of one actor, already projected to room pixels. */
export interface ActorView {
  id: string;
  sprite: string;
  screen: Vec2;
  depth: number;
  facing: Facing;
  moving: boolean;
  visible: boolean;
}
