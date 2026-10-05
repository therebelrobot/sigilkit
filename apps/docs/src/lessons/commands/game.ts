import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "####################",
    "####################",
    "#..................#",
    "#..pp.........bb...#",
    "#..pp.........bb...#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  entries: { start: { at: { x: 7, y: 8 }, facing: "up" } },
  actors: { moth: { at: { x: 11, y: 6 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, width: number, height: number, lift = 0) =>
  tileArea({ ...greenhouseBase, hotspots: [] }, x, y, width, height, lift);

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "planter",
      name: "planter",
      shape: area(3, 3, 2, 2, 6),
      standAt: { x: 4, y: 5 },
      face: "up",
      verbs: { look: "planter_look" },
    },
    {
      id: "bench",
      name: "workbench",
      shape: area(14, 3, 2, 2, 8),
      standAt: { x: 14, y: 5 },
      face: "up",
      verbs: { look: "bench_look" },
    },
  ],
});

export const game = defineGame({
  title: "Commands and cutscenes",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_tour", look: "moth_look" } },
  },
  rooms: { greenhouse },
  fallback: () => "Nothing interesting.",
});
