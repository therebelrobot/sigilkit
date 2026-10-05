import { defineGame, defineRoom } from "sigilkit";

export const plaza = defineRoom({
  id: "plaza",
  projection: "orthogonal",
  tile: { width: 16, height: 16 },
  walkmap: [
    "####################",
    "####################",
    "#..................#",
    "#...oo........oo...#",
    "#...oo........oo...#",
    "#..................#",
    "#.......####.......#",
    "#..................#",
    "#..................#",
    "#..................#",
    "####################",
  ],
  entries: {
    west: { at: { x: 3, y: 8 }, facing: "right" },
    east: { at: { x: 16, y: 8 }, facing: "left" },
  },
  hotspots: [],
});

/** One game definition per player, so each sees themselves in their own colour. */
export const gameFor = (startEntry: "west" | "east", color: string) =>
  defineGame({
    title: "Shared presence",
    resolution: { width: 320, height: 180 },
    player: "me",
    startRoom: "plaza",
    startEntry,
    actors: { me: { name: "Me", sprite: "player", speed: 5, color } },
    rooms: { plaza },
  });
