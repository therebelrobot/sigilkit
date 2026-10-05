import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const cottageBase = {
  id: "cottage",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  //          x: 0123456789
  walkmap: [
    /* y0 */ "##########",
    /* y1 */ "#....#...#",
    /* y2 */ "#........#", // (5,2): doorway from the hall into the annex
    /* y3 */ "#....#...#",
    /* y4 */ "##.#######", // (2,4): the front door
    /* y5 */ "..........",
    /* y6 */ "..........",
    /* y7 */ "..........",
  ],
  // One letter per tile, like the walkmap. Spaces mean "no area" (outside).
  // Doorways stay outside every area, so stepping through one changes area.
  areamap: [
    /* y0 */ "          ",
    /* y1 */ " hhhh aaa ",
    /* y2 */ " hhhh aaa ",
    /* y3 */ " hhhh aaa ",
  ],
  areas: [
    // interior: while you're inside, walls in front fade and the outside is shaded.
    { id: "hall", key: "h", name: "the hall", interior: true },
    // reveal "once": hidden under fog until the first time you walk in.
    { id: "annex", key: "a", name: "the annex", interior: true, reveal: "once", onEnter: "annex_enter" },
  ],
  entries: { start: { at: { x: 2, y: 6 }, facing: "up" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, lift: number) => tileArea({ ...cottageBase, hotspots: [] }, x, y, 1, 1, lift);

export const cottage = defineRoom({
  ...cottageBase,
  hotspots: [
    {
      id: "rug",
      name: "rug",
      shape: area(2, 2, 2),
      standAt: { x: 2, y: 3 },
      verbs: { look: "rug_look" },
    },
    {
      // In the annex: can't be clicked until the annex is revealed.
      id: "chest",
      name: "old chest",
      shape: area(8, 1, 12),
      standAt: { x: 7, y: 1 },
      verbs: { look: "chest_look" },
    },
  ],
});

export const game = defineGame({
  title: "Interiors and fog",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "cottage",
  defaultVerb: "look",
  actors: { wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" } },
  rooms: { cottage },
  fallback: () => "Nothing interesting.",
});
