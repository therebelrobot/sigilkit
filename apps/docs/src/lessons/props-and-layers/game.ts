import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const gardenBase = {
  id: "garden",
  projection: "isometric",
  directions: 8,
  tile: { width: 32, height: 16 },
  walkmap: [
    "##########",
    "#........#",
    "#.....w..#", // w: the pinwheel's tile
    "#..l.....#", // l: the lamp post's tile
    "#........#",
    "#........#",
    "#........#",
    "##########",
  ],
  // Scenery that depth-sorts with actors. These have no `asset`: the renderer's
  // prop factory (props.ts) draws them. Without a factory, `asset` art is used.
  props: [
    { id: "lamp", tile: { x: 3, y: 3 } },
    { id: "pinwheel", tile: { x: 6, y: 2 } },
  ],
  entries: { start: { at: { x: 4, y: 5 }, facing: "up" } },
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, lift: number) => tileArea({ ...gardenBase, hotspots: [] }, x, y, 1, 1, lift);

export const garden = defineRoom({
  ...gardenBase,
  hotspots: [
    { id: "lamp", name: "lamp post", shape: area(3, 3, 40), standAt: { x: 4, y: 3 }, default: "use", verbs: { use: "lamp_use", look: "lamp_look" } },
    { id: "pinwheel", name: "pinwheel", shape: area(6, 2, 30), standAt: { x: 6, y: 3 }, verbs: { look: "pinwheel_look" } },
  ],
});

export const game = defineGame({
  title: "Props and effect layers",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "garden",
  defaultVerb: "look",
  actors: { wren: { name: "Wren", sprite: "wren", speed: 4, color: "#f3d27a" } },
  flags: { lamp_lit: true },
  rooms: { garden },
  fallback: () => "Nothing interesting.",
});
