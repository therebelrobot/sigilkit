import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const yardBase = {
  id: "yard",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  //          x: 0123456789
  walkmap: [
    /* y0 */ "##########",
    /* y1 */ "#....kkk.#", // k: solid ground under the deck
    /* y2 */ "#....kkk.#",
    /* y3 */ "#....kkk.#",
    /* y4 */ "#........#",
    /* y5 */ "####.###.#", // two gaps: a low arch at x4, a full doorway at x8
    /* y6 */ "#........#",
    /* y7 */ "#........#",
    /* y8 */ "##########",
  ],
  // Floors above the base walkmap. Same grid; empty rows where there's nothing.
  // On a raised level, anything but '.' and '#' is open air.
  levels: [
    {
      id: "deck",
      elevation: 16, // pixels above the ground, on screen
      walkmap: ["", "     ...", "     ...", "     ..."],
    },
  ],
  stairs: [
    // Steps are ground tiles, bottom to top. `top` is the landing on the deck.
    { to: "deck", steps: [{ x: 3, y: 2 }, { x: 4, y: 2 }], top: { x: 5, y: 2 } },
  ],
  // The arch at (4, 5) is only one block high. Levels work out headroom on their
  // own; this is for openings they don't describe.
  clearances: [{ tiles: [{ x: 4, y: 5 }], height: 16 }],
  entries: { start: { at: { x: 2, y: 7 }, facing: "up" } },
  actors: { pip: { at: { x: 6, y: 7 }, facing: "left" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, lift: number, level?: string) =>
  tileArea({ ...yardBase, hotspots: [] }, x, y, 1, 1, lift, level);

export const yard = defineRoom({
  ...yardBase,
  hotspots: [
    {
      id: "telescope",
      name: "telescope",
      shape: area(7, 1, 18, "deck"),
      // standAt is on the deck: clicking from the ground walks via the stairs.
      standAt: { x: 6, y: 1 },
      level: "deck",
      verbs: { look: "telescope_look" },
    },
    {
      id: "arch",
      name: "low arch",
      shape: area(4, 5, 16),
      verbs: { look: "arch_look" },
    },
  ],
});

export const game = defineGame({
  title: "Levels and stairs",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "yard",
  defaultVerb: "look",
  actors: {
    // No height: two tile heights (32 px), "two blocks".
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    // Pip fits under the arch.
    pip: { name: "Pip", sprite: "cat", speed: 4, height: 12, color: "#b8b2c8", verbs: { talk: "pip_talk", look: "pip_look" } },
  },
  rooms: { yard },
  fallback: () => "Nothing interesting.",
});
