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
    "#......bbbb........#",
    "####################",
  ],
  entries: { start: { at: { x: 5, y: 6 }, facing: "right" } },
  actors: { moth: { at: { x: 12, y: 6 }, facing: "left" } },
  // Drawn by the lesson's prop factory; see the Props lesson.
  props: [{ id: "can", tile: { x: 8, y: 9 } }],
} satisfies Omit<RoomDef, "hotspots">;

const area = (x: number, y: number, width: number, height: number, lift = 0) =>
  tileArea({ ...greenhouseBase, hotspots: [] }, x, y, width, height, lift);

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "can",
      name: "watering can",
      shape: area(8, 9, 1, 1, 10),
      standAt: { x: 8, y: 8 },
      face: "down",
      default: "take",
      // Gone from the room once it's in your pocket.
      when: (world) => !world.flag("took_can"),
      // Sits on the bench, so it must win the click over it.
      z: 1,
      verbs: { look: "can_look", take: "can_take", use: "can_take" },
    },
    {
      id: "bench",
      name: "potting bench",
      shape: area(7, 9, 4, 1, 8),
      standAt: { x: 9, y: 8 },
      face: "down",
      verbs: { look: "bench_look" },
    },
    {
      id: "planter",
      name: "dry planter",
      shape: area(3, 3, 2, 2, 6),
      standAt: { x: 4, y: 5 },
      face: "up",
      verbs: { look: "planter_look", use: "planter_use" },
    },
  ],
});

export const game = defineGame({
  title: "Items and inventory",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    moth: { name: "Moth", sprite: "moth", speed: 3, color: "#9fe0d4", verbs: { talk: "moth_talk", look: "moth_look" } },
  },
  items: {
    can: {
      name: "watering can",
      // The inventory UI can draw this key as an icon (see renderIcon on InventoryBar).
      icon: "can",
      // "Use watering can with <target>": target id -> handler.
      with: { planter: "planter_water", moth: "moth_water" },
    },
  },
  flags: { took_can: false, planter_watered: false },
  rooms: { greenhouse },
  fallback: (verb) => (verb === "use" ? "That doesn't do anything." : "Nothing interesting."),
});
