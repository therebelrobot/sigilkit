export * from "./types";
export * from "./projection";
export * from "./events";
export * from "./shapes";
export { parseWalkmap, type Walkmap } from "./walkmap";
export { tokenize, parseValue, builtinCommands, type CommandFn } from "./commands";
export { World, facingToward, type ScriptRunner, type WorldEvents, type WorldOptions } from "./world";

import type { GameDef, RoomDef } from "./types";

/** Identity helpers that give you type checking and editor completion on content files. */
export const defineGame = <T extends GameDef>(game: T): T => game;
export const defineRoom = <T extends RoomDef>(room: T): T => room;
