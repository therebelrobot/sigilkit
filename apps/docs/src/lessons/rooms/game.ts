import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

// ------------------------------------------------------------- greenhouse

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "####################",
    "####################",
    "#..................#",
    "#..pp..............#",
    "#..pp..............#",
    "#...................", // doorway to the shed at (19, 5)
    "#..................#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  entries: {
    start: { at: { x: 5, y: 7 }, facing: "right" },
    // Where you arrive coming back from the shed.
    "from-shed": { at: { x: 18, y: 5 }, facing: "left" },
  },
  // Room music: an asset key the audio layer resolves (see the Audio lesson).
  music: "greenhouse-theme",
  onEnter: "greenhouse_enter",
} satisfies Omit<RoomDef, "hotspots">;

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "shed-door",
      name: "door to the shed",
      shape: tileArea({ ...greenhouseBase, hotspots: [] }, 19, 5, 1, 1, 24),
      standAt: { x: 18, y: 5 },
      default: "walk",
      verbs: { walk: "to_shed", look: "shed_door_look" },
    },
  ],
});

// ------------------------------------------------------------------- shed

const shedBase = {
  id: "shed",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "############",
    "############",
    "#..tt......#",
    "#..........#",
    "#.........hh",
    "...........#", // doorway back at (0, 5)
    "#..........#",
    "############",
  ],
  entries: { door: { at: { x: 1, y: 5 }, facing: "right" } },
  actors: { moth: { at: { x: 8, y: 3 }, facing: "left" } },
  music: "shed-theme",
  onEnter: "shed_enter",
} satisfies Omit<RoomDef, "hotspots">;

export const shed = defineRoom({
  ...shedBase,
  hotspots: [
    {
      id: "greenhouse-door",
      name: "door to the greenhouse",
      shape: tileArea({ ...shedBase, hotspots: [] }, 0, 5, 1, 1, 24),
      standAt: { x: 1, y: 5 },
      default: "walk",
      verbs: { walk: "to_greenhouse" },
    },
    {
      id: "tools",
      name: "tool rack",
      shape: tileArea({ ...shedBase, hotspots: [] }, 3, 2, 2, 1, 10),
      standAt: { x: 3, y: 3 },
      face: "up",
      verbs: { look: "tools_look" },
    },
  ],
});

export const game = defineGame({
  title: "Moving between rooms",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  startEntry: "start",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk" } },
  },
  rooms: { greenhouse, shed },
  fallback: () => "Nothing interesting.",
});
