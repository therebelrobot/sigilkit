import { defineGame, defineRoom } from "sigilkit";

/**
 * One room, one character. `walkmap` comes from walkmap.txt: one string per
 * row, '.' is floor, '#' is wall, and any other letter is blocked floor
 * under furniture.
 */
export function createGame(walkmap: string[]) {
  const greenhouse = defineRoom({
    id: "greenhouse",
    projection: "orthogonal",
    // Each walkmap character is a 16 × 16 pixel tile.
    tile: { width: 16, height: 16 },
    walkmap,
    // Where the player appears.
    entries: { start: { at: { x: 4, y: 7 }, facing: "right" } },
    // Nothing to click yet: that's the next lesson.
    hotspots: [],
  });

  return defineGame({
    title: "A room to walk in",
    // The logical screen. The renderer scales it to fit, keeping pixels crisp.
    resolution: { width: 320, height: 180 },
    player: "wren",
    startRoom: "greenhouse",
    actors: {
      wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" },
    },
    rooms: { greenhouse },
  });
}
