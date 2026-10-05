export * from "./types";
export * from "./projection";
export * from "./events";
export * from "./shapes";
export { parseWalkmap, type Walkmap } from "./walkmap";
export { DEFAULT_BASE_LEVEL, ELEVATION_SORT_BIAS, RoomLayout, type LayoutLevel, type StairEnds } from "./levels";
export { tokenize, parseValue, builtinCommands, type CommandFn } from "./commands";
export { World, facingOfStep, facingToward, screenFacing, type ScriptRunner, type WorldEvents, type WorldOptions } from "./world";

import type { GameDef, RoomDef } from "./types";

/** Identity helpers that give you type checking and editor completion on content files. */
export const defineGame = <T extends GameDef>(game: T): T => game;
export const defineRoom = <T extends RoomDef>(room: T): T => room;
