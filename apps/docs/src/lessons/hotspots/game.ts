import { defineGame, defineRoom, tileArea, type RoomDef } from "sigilkit";

const greenhouseBase = {
  id: "greenhouse",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  //          x: 01234567890123456789
  walkmap: [
    /* y0  */ "####################",
    /* y1  */ "####################",
    /* y2  */ "#..................#",
    /* y3  */ "#..pp.........bb...#",
    /* y4  */ "#..pp.........bb...#",
    /* y5  */ "#..................#",
    /* y6  */ "#...................", // a doorway on the right
    /* y7  */ "#..................#",
    /* y8  */ "#..................#",
    /* y9  */ "#........c.........#",
    /* y10 */ "####################",
  ],
  entries: { start: { at: { x: 6, y: 7 }, facing: "right" } },
} satisfies Omit<RoomDef, "hotspots">;

/** A hotspot shape over a block of tiles, raised by `lift` pixels to cover what stands there. */
const area = (x: number, y: number, width: number, height: number, lift = 0) =>
  tileArea({ ...greenhouseBase, hotspots: [] }, x, y, width, height, lift);

export const greenhouse = defineRoom({
  ...greenhouseBase,
  hotspots: [
    {
      id: "planter",
      name: "dry planter",
      shape: area(3, 3, 2, 2, 6),
      // Walk here first, then face the planter, then run the verb.
      standAt: { x: 4, y: 5 },
      face: "up",
      verbs: {
        look: ({ world }) => world.say("wren", "The soil's cracked like an old circuit board."),
        // Handlers can be async: the player stays busy until they finish.
        use: async ({ world }) => {
          await world.say("wren", "I push a finger into the soil.");
          await world.say("wren", "Bone dry, all the way down.");
        },
      },
    },
    {
      id: "window",
      name: "skylight",
      shape: area(8, 1, 4, 1),
      standAt: { x: 9, y: 2 },
      face: "up",
      verbs: {
        look: ({ world }) => world.say("wren", "Clouds. It's going to rain on everything except these plants."),
        use: ({ world }) => world.say("wren", "It's painted shut."),
      },
    },
    {
      id: "bench",
      name: "workbench",
      shape: area(14, 3, 2, 2, 8),
      standAt: { x: 14, y: 5 },
      face: "up",
      verbs: {
        look: ({ world }) => world.say("wren", "Seed packets, a soldering iron, and a mug that says WORLD'S OKAYEST ROBOT."),
        take: ({ world }) => world.say("wren", "The whole bench? Ambitious."),
      },
    },
    {
      id: "crate",
      name: "seed crate",
      shape: area(9, 9, 1, 1, 6),
      standAt: { x: 9, y: 8 },
      face: "down",
      // Overlaps nothing here, but a higher z wins when shapes overlap.
      z: 1,
      verbs: {
        look: ({ world }) => world.say("wren", "Labelled TOMATOES in handwriting that clearly means CABLES."),
      },
    },
    {
      id: "door",
      name: "garden door",
      shape: area(19, 6, 1, 1, 24),
      standAt: { x: 18, y: 6 },
      face: "right",
      // A plain click on the door uses "walk", not the game's default verb.
      default: "walk",
      verbs: {
        walk: ({ world }) => world.say("wren", "Not until the seedlings are seen to."),
        look: ({ world }) => world.say("wren", "The way out to the garden."),
      },
    },
  ],
});

export const game = defineGame({
  title: "Hotspots and verbs",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "greenhouse",
  // The verb a plain click uses on a hotspot that doesn't set its own `default`.
  defaultVerb: "look",
  actors: {
    wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
  },
  rooms: { greenhouse },
  // What the player says when a verb has no handler on its target.
  fallback: (verb) =>
    ({ take: "I'll leave that where it is.", talk: "It doesn't say much.", use: "That doesn't do anything." })[verb] ??
    "Nothing interesting.",
});
