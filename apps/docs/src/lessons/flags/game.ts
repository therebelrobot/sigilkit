import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "####################",
    "####################",
    "#..................#",
    "#..pp..........ss..#",
    "#..pp..........ss..#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  entries: { start: { at: { x: 8, y: 7 }, facing: "up" } },
  actors: { moth: { at: { x: 12, y: 6 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, width: number, height: number, lift = 0) =>
  tileArea({ ...greenhouseBase, hotspots: [] }, x, y, width, height, lift);

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "breaker",
      name: "breaker switch",
      shape: area(9, 1, 1, 1),
      standAt: { x: 9, y: 2 },
      face: "up",
      default: "use",
      verbs: { use: "breaker_use", look: "breaker_look" },
    },
    {
      id: "planter",
      name: "planter",
      shape: area(3, 3, 2, 2, 6),
      standAt: { x: 4, y: 5 },
      face: "up",
      verbs: { look: "planter_look" },
    },
    {
      // Only there while the power is on: a hotspot can depend on any flag.
      id: "sprout",
      name: "glowing sprout",
      shape: area(15, 3, 2, 2, 10),
      standAt: { x: 15, y: 5 },
      face: "up",
      when: (world) => world.flag("power") === true,
      verbs: { look: "sprout_look", take: "sprout_take" },
    },
    {
      id: "shelf",
      name: "dark shelf",
      shape: area(15, 3, 2, 2, 10),
      standAt: { x: 15, y: 5 },
      face: "up",
      when: (world) => world.flag("power") !== true,
      verbs: { look: "shelf_look" },
    },
  ],
});

export const game = defineGame({
  title: "Flags and conditions",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk", look: "moth_look" } },
  },
  // Starting values. Flags are strings, numbers or booleans.
  flags: { power: false, switch_flips: 0 },
  rooms: { greenhouse },
  fallback: () => "Nothing interesting.",
});
