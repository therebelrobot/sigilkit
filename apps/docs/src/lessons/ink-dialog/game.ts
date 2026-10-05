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
  entries: { start: { at: { x: 5, y: 7 }, facing: "right" } },
  // Moth lives in this room, at this tile.
  actors: { moth: { at: { x: 12, y: 6 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, width: number, height: number, lift = 0) =>
  tileArea({ ...greenhouseBase, hotspots: [] }, x, y, width, height, lift);

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "planter",
      name: "dry planter",
      shape: area(3, 3, 2, 2, 6),
      standAt: { x: 4, y: 5 },
      face: "up",
      // Strings are Ink knots: === planter_look === in story.ink.
      verbs: { look: "planter_look", use: "planter_use" },
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
  title: "Talking with Ink",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    // Actors take verbs too. Clicking Moth uses "talk" by default.
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk", look: "moth_look" } },
  },
  rooms: { greenhouse },
  fallback: () => "Nothing interesting.",
});
