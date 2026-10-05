import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const cellarBase = {
  id: "cellar",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  //          x: 01234567890123456789
  walkmap: [
    /* y0  */ "####################",
    /* y1  */ "####################",
    /* y2  */ "#........#.........#",
    /* y3  */ "#........#.........#",
    /* y4  */ "#........#.........#",
    /* y5  */ "#..................#", // (9,5): the gate. Written as '.', the door closes it.
    /* y6  */ "#........#.........#",
    /* y7  */ "#........#.........#",
    /* y8  */ "#..................#", // (9,8): a gap in the wall, for now
    /* y9  */ "#........#.........#",
    /* y10 */ "####################",
  ],
  doors: [
    // Walkable only while the flag is truthy. A function works too:
    // openWhen: (world) => world.has("winch_handle")
    { id: "gate", tiles: [{ x: 9, y: 5 }], openWhen: "gate_open" },
  ],
  entries: { start: { at: { x: 3, y: 8 }, facing: "right" } },
  actors: { moth: { at: { x: 3, y: 5 }, facing: "right" } },
} satisfies Omit<RoomDef, "hotspots">;

export const cellar = defineRoom({
  ...cellarBase,
  hotspots: [
    {
      id: "gate",
      name: "iron gate",
      shape: tileArea({ ...cellarBase, hotspots: [] }, 9, 5, 1, 1, 18),
      standAt: { x: 8, y: 5 },
      face: "right",
      default: "use",
      verbs: { use: "gate_use", look: "gate_look" },
    },
  ],
});

export const game = defineGame({
  title: "Doors and walkability",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "cellar",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { look: "moth_look" } },
  },
  flags: { gate_open: true },
  rooms: { cellar },
  fallback: () => "Nothing interesting.",
});
