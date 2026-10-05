import { defineGame, defineRoom, tileArea, type ProjectionKind, type RoomDef } from "sigilkit";

/**
 * The same courtyard twice. Only `projection`, `tile` and `directions` differ:
 * the walkmap, hotspots and story are shared.
 */
function courtyard(id: string, projection: ProjectionKind): RoomDef {
  const base = {
    id,
    projection,
    // Isometric tiles are usually twice as wide as they are tall.
    tile: projection === "isometric" ? { width: 32, height: 16 } : { width: 16, height: 16 },
    // 8 directions lets stick and arrow-key play step diagonally, which is
    // what "up" on screen is in an isometric room.
    directions: projection === "isometric" ? 8 : 4,
    walkmap: [
      "##########",
      "#........#",
      "#..ff....#",
      "#..ff..o.#",
      "#........#",
      "#.....##.#",
      "#........#",
      "##########",
    ],
    entries: { start: { at: { x: 2, y: 5 }, facing: "right" } },
  } satisfies Omit<RoomDef, "hotspots">;

  // tileArea asks the room's projection where the tiles are, so these hotspot
  // shapes are diamonds in one room and squares in the other.
  const area = (x: number, y: number, width: number, height: number, lift: number) =>
    tileArea({ ...base, hotspots: [] }, x, y, width, height, lift);

  return defineRoom({
    ...base,
    hotspots: [
      {
        id: "fountain",
        name: "dry fountain",
        shape: area(3, 2, 2, 2, 10),
        standAt: { x: 4, y: 4 },
        verbs: { look: "fountain_look" },
      },
      {
        id: "urn",
        name: "stone urn",
        shape: area(7, 3, 1, 1, 14),
        standAt: { x: 7, y: 4 },
        verbs: { look: "urn_look" },
      },
    ],
  });
}

export const game = defineGame({
  title: "Isometric rooms",
  resolution: { width: 320, height: 180 },
  player: "wren",
  startRoom: "courtyard-iso",
  defaultVerb: "look",
  actors: { wren: { name: "Wren", sprite: "wren", speed: 5, color: "#f3d27a" } },
  rooms: {
    "courtyard-iso": courtyard("courtyard-iso", "isometric"),
    "courtyard-flat": courtyard("courtyard-flat", "orthogonal"),
  },
  fallback: () => "Nothing interesting.",
});
