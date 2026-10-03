import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

/*
 * Demo content. Pure data plus story paths: no asset imports, no DOM,
 * so the multiplayer server can load the exact same file.
 * Strings in `verbs` are Ink knots in ./story/main.ink.
 */

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  // '.' walkable. The art (or blockout) is drawn separately; this is just where feet can go.
  walkmap: [
    "####################",
    "####################",
    "####################",
    "#################..#",
    "#..................#",
    "#..###.......###...#",
    "#..###.......###...#",
    "#..................#",
    "#..................#",
    "#.....####.........#",
    "####################",
  ],
  entries: {
    start: { at: { x: 4, y: 8 }, facing: "right" },
    door: { at: { x: 17, y: 4 }, facing: "down" },
  },
  actors: { moth: { at: { x: 11, y: 7 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "door",
      name: "roof door",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 17, 3, 2, 1, 24),
      standAt: { x: 17, y: 4 },
      face: "up",
      default: "walk",
      verbs: { walk: "door_walk", look: "door_look", use: "door_walk" },
    },
    {
      id: "planter",
      name: "dry planter",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 3, 5, 3, 2, 6),
      standAt: { x: 4, y: 7 },
      face: "up",
      verbs: { look: "planter_look", use: "planter_use", take: "planter_take" },
    },
    {
      id: "can",
      name: "watering can",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 7, 9, 1, 1, 8),
      standAt: { x: 7, y: 8 },
      face: "down",
      default: "take",
      when: (w) => !w.flag("took_can"),
      z: 1,
      verbs: { look: "can_look", take: "can_take", use: "can_take" },
    },
    {
      id: "bench",
      name: "workbench",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 6, 9, 4, 1, 8),
      standAt: { x: 8, y: 8 },
      face: "down",
      verbs: { look: "bench_look" },
    },
  ],
});

const rooftopBase = {
  id: "rooftop",
  projection: "isometric",
  tile: { width: 32, height: 16 },
  walkmap: [
    "........",
    "..##....",
    "..##....",
    "........",
    "......#.",
    "........",
    "........",
    "....#...",
  ],
  entries: { hatch: { at: { x: 4, y: 6 }, facing: "up" } },
  onEnter: "rooftop_enter",
} satisfies Omit<RoomDef, "hotspots">;

export const rooftop = defineRoom({
  ...rooftopBase,
  hotspots: [
    {
      id: "panels",
      name: "solar panels",
      shape: tileArea({ ...rooftopBase, hotspots: [] }, 2, 1, 2, 2, 16),
      standAt: { x: 4, y: 2 },
      verbs: { look: "panels_look", use: "panels_use" },
    },
    {
      id: "hatch",
      name: "hatch",
      shape: tileArea({ ...rooftopBase, hotspots: [] }, 4, 7, 1, 1, 16),
      standAt: { x: 4, y: 6 },
      default: "walk",
      verbs: { walk: "hatch_walk", use: "hatch_walk", look: "hatch_look" },
    },
    {
      id: "planter-box",
      name: "planter box",
      shape: tileArea({ ...rooftopBase, hotspots: [] }, 6, 4, 1, 1, 16),
      standAt: { x: 5, y: 4 },
      verbs: { look: "box_look" },
    },
  ],
});

export const game = defineGame({
  title: "Greenhouse",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  startEntry: "start",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk", look: "moth_look" } },
  },
  items: {
    can: { name: "watering can", icon: "can", verbs: { look: "can_look" }, with: { planter: "planter_water", "planter-box": "box_water" } },
  },
  rooms: { greenhouse, rooftop },
  flags: { roof_unlocked: false },
  fallback: (verb) =>
    ({ take: "I'll leave that where it is.", talk: "It doesn't say much.", use: "That doesn't do anything." })[verb] ??
    "Nothing interesting.",
});

export type Game = typeof game;
