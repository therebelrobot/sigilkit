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
      id: "walkway",
      name: "walkway to the watchtower",
      shape: tileArea({ ...rooftopBase, hotspots: [] }, 0, 7, 1, 1, 4),
      standAt: { x: 0, y: 7 },
      default: "walk",
      verbs: { walk: "walkway_walk", look: "walkway_look" },
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


/*
 * Multi-level demo: a watchtower yard. The hall is an interior with a doorway at (2,4);
 * the annex and store are attached rooms, hidden until first entered. Outside, stairs
 * climb three levels: the yard to a porch, the porch to a balcony that runs over the
 * hall's doorway, and the balcony to the roof.
 */
const watchtowerBase = {
  id: "watchtower",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  origin: { x: 176, y: 72 },
  size: { width: 352, height: 260 },
  // Walls as tall as the roof is high, so the roof sits on them.
  wallHeight: 48,
  //          x: 0123456789
  walkmap: [
    /* y0 */ "##########",
    /* y1 */ "#....#...#",
    /* y2 */ "#........#",
    /* y3 */ "#....#...#",
    /* y4 */ "##.###.###",
    /* y5 */ "....p#...#",
    /* y6 */ "....p....#", // (5,6): a cat flap into the store, one block high
    /* y7 */ ".....#####",
    /* y8 */ "..........",
    /* y9 */ "..........",
  ],
  areamap: [
    "          ",
    " hhhh aaa ",
    " hhhh aaa ",
    " hhhh aaa ",
    "          ",
    "      sss ",
    "      sss ",
  ],
  levels: [
    { id: "porch", elevation: 16, walkmap: ["", "", "", "", "", "", "    .     "] },
    { id: "balcony", elevation: 32, walkmap: ["", "", "", "", "", "  ..      "] },
    {
      id: "roof",
      elevation: 48,
      walkmap: ["..........", "..........", "..........", "..........", "..........", "     .....", "     .....", "     ....."],
    },
  ],
  stairs: [
    { to: "porch", steps: [{ x: 4, y: 8 }, { x: 4, y: 7 }], top: { x: 4, y: 6 } },
    { from: "porch", to: "balcony", steps: [{ x: 4, y: 5 }], top: { x: 3, y: 5 } },
    { from: "balcony", to: "roof", steps: [{ x: 1, y: 5 }], top: { x: 1, y: 4 } },
  ],
  areas: [
    { id: "hall", key: "h", name: "the hall", interior: true },
    { id: "annex", key: "a", name: "the annex", interior: true, reveal: "once" },
    { id: "store", key: "s", name: "the store", interior: true, reveal: "once", onEnter: "store_enter" },
  ],
  // Too low for Wren (two blocks tall): she has to go round through the annex.
  clearances: [{ tiles: [{ x: 5, y: 6 }], height: 16 }],
  entries: { path: { at: { x: 1, y: 9 }, facing: "up" } },
} satisfies Omit<RoomDef, "hotspots">;

export const watchtower = defineRoom({
  ...watchtowerBase,
  hotspots: [
    {
      id: "path",
      name: "path back to the roof garden",
      shape: tileArea({ ...watchtowerBase, hotspots: [] }, 0, 9, 1, 1, 4),
      standAt: { x: 0, y: 9 },
      default: "walk",
      verbs: { walk: "watchtower_leave", look: "watchtower_path_look" },
    },
    {
      id: "lantern",
      name: "storm lantern",
      shape: tileArea({ ...watchtowerBase, hotspots: [] }, 7, 6, 1, 1, 14),
      standAt: { x: 7, y: 5 },
      verbs: { look: "lantern_look" },
    },
    {
      id: "telescope",
      name: "telescope",
      shape: tileArea({ ...watchtowerBase, hotspots: [] }, 8, 1, 1, 1, 18, "roof"),
      standAt: { x: 8, y: 1 },
      level: "roof",
      verbs: { look: "telescope_look" },
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
  rooms: { greenhouse, rooftop, watchtower },
  flags: { roof_unlocked: false },
  fallback: (verb) =>
    ({ take: "I'll leave that where it is.", talk: "It doesn't say much.", use: "That doesn't do anything." })[verb] ??
    "Nothing interesting.",
});

export type Game = typeof game;
