import { ELEVATION_SORT_BIAS, type AreaDef, type Projection, type RoomLayout, type TilePos, type World } from "../core/index";
import { Container, Graphics } from "pixi.js";

/** How cutaways, the shade outside an interior, and fog over unrevealed areas look. */
export interface AreaLook {
  /** Alpha that cut-away walls, floors, props and actors fade to. Default 0.08; 0 hides them entirely. */
  cutawayAlpha: number;
  /** Shade laid over everything outside the interior the player is in. */
  shadeColor: number;
  /** Default 0.55; 0 turns the shade off. */
  shadeAlpha: number;
  /** Fog over areas that aren't revealed yet. Default: the letterbox colour. */
  fogColor: number;
  /** Default 1 (opaque). */
  fogAlpha: number;
  /** How far above each floor tile the shade's cut-out reaches, in pixels. Default: the room's wall height, or two tile heights. */
  headroom?: number;
  /** Fade time for all of the above, in ms. Default 350. */
  fadeMs: number;
}

export const DEFAULT_AREA_LOOK: Omit<AreaLook, "fogColor"> = {
  cutawayAlpha: 0.08,
  shadeColor: 0x000000,
  shadeAlpha: 0.55,
  fogAlpha: 1,
  fadeMs: 350,
};

/**
 * Something drawn for the room that a cutaway can fade: a blockout wall, an upper
 * floor slab, a stair riser, a prop. `tiles` are the tiles it stands on; it fades
 * when any of them is cut away, or when it's listed in the interior's `cover`.
 */
export interface RoomPiece {
  view: Container;
  level: string;
  tiles: TilePos[];
  propId?: string;
}

/** Draw-order key for something standing on a tile at a height (matches `ActorView.sortY`). */
export function sortKeyFor(projection: Projection, tileX: number, tileY: number, elevation: number): number {
  return projection.tileToScreen(tileX, tileY).y + elevation * ELEVATION_SORT_BIAS;
}

/** The tile's floor outline (diamond or square), raised by `elevation` pixels. */
export function tileOutline(projection: Projection, tileX: number, tileY: number, elevation = 0): number[] {
  const corner = (cornerX: number, cornerY: number) => {
    const point = projection.tileToScreen(cornerX, cornerY);
    return [point.x, point.y - elevation];
  };
  if (projection.kind === "isometric")
    return [
      ...corner(tileX - 0.5, tileY - 0.5), // top
      ...corner(tileX + 0.5, tileY - 0.5), // right
      ...corner(tileX + 0.5, tileY + 0.5), // bottom
      ...corner(tileX - 0.5, tileY + 0.5), // left
    ];
  const [topLeftX, topLeftY] = corner(tileX - 0.5, tileY - 0.5) as [number, number];
  const [bottomRightX, bottomRightY] = corner(tileX + 0.5, tileY + 0.5) as [number, number];
  return [topLeftX, topLeftY, bottomRightX, topLeftY, bottomRightX, bottomRightY, topLeftX, bottomRightY];
}

/** A tile's floor outline swept upward by `headroom`: the space above it where walls and furniture stand. */
export function tilePrism(projection: Projection, tileX: number, tileY: number, elevation: number, headroom: number): number[] {
  const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] = tileOutline(projection, tileX, tileY, elevation) as [
    number, number, number, number, number, number, number, number,
  ];
  if (projection.kind === "isometric")
    return [topX, topY - headroom, rightX, rightY - headroom, rightX, rightY, bottomX, bottomY, leftX, leftY, leftX, leftY - headroom];
  return [topX, topY - headroom, rightX, rightY - headroom, bottomX, bottomY, leftX, leftY];
}

export interface BlockFaces {
  top: number;
  left: number;
  right: number;
}

/**
 * A block standing on a tile, from `baseElevation` up to `topElevation`. Isometric
 * blocks show their top and two front faces; orthogonal ones their top and front.
 */
export function drawBlock(
  projection: Projection,
  tileX: number,
  tileY: number,
  baseElevation: number,
  topElevation: number,
  faces: BlockFaces,
): Graphics {
  const base = tileOutline(projection, tileX, tileY, baseElevation);
  const top = tileOutline(projection, tileX, tileY, topElevation);
  const block = new Graphics();
  if (projection.kind === "isometric") {
    const [, , baseRightX, baseRightY, baseBottomX, baseBottomY, baseLeftX, baseLeftY] = base as number[] as [
      number, number, number, number, number, number, number, number,
    ];
    const [, , topRightX, topRightY, topBottomX, topBottomY, topLeftX, topLeftY] = top as number[] as [
      number, number, number, number, number, number, number, number,
    ];
    block
      .poly([baseLeftX, baseLeftY, baseBottomX, baseBottomY, topBottomX, topBottomY, topLeftX, topLeftY])
      .fill(faces.left)
      .poly([baseBottomX, baseBottomY, baseRightX, baseRightY, topRightX, topRightY, topBottomX, topBottomY])
      .fill(faces.right);
  } else {
    const [, , , , baseBottomRightX, baseBottomRightY, baseBottomLeftX] = base as number[] as [number, number, number, number, number, number, number];
    const [, , , , topBottomRightX, topBottomRightY, topBottomLeftX] = top as number[] as [number, number, number, number, number, number, number];
    block
      .poly([topBottomLeftX, topBottomRightY, topBottomRightX, topBottomRightY, baseBottomRightX, baseBottomRightY, baseBottomLeftX, baseBottomRightY])
      .fill(faces.left);
  }
  return block.poly(top).fill(faces.top);
}

export interface LevelBlockoutStyle {
  wallTop: number;
  wallLeft: number;
  wallRight: number;
  floorTop: number;
  floorSide: [left: number, right: number];
  wallHeight: number;
  slabThickness: number;
}

/**
 * Blockout for everything a multi-level room adds above its base floor: stair
 * risers, the floor slabs of raised levels, and walls on raised levels. Each is
 * its own piece so cutaways can fade it, sorted with actors by tile and height.
 */
export function levelBlockoutPieces(world: World, layout: RoomLayout, style: LevelBlockoutStyle): RoomPiece[] {
  const projection = world.projection;
  const pieces: RoomPiece[] = [];
  const addPiece = (view: Graphics, level: string, tileX: number, tileY: number, sortElevation: number, sortNudge: number) => {
    view.zIndex = sortKeyFor(projection, tileX, tileY, sortElevation) + sortNudge;
    pieces.push({ view, level, tiles: [{ x: tileX, y: tileY }] });
  };
  for (const step of layout.steps) {
    const levelElevation = layout.level(step.level).elevation;
    const riser = drawBlock(projection, step.x, step.y, levelElevation, step.elevation, {
      top: style.floorTop,
      left: style.floorSide[0],
      right: style.floorSide[1],
    });
    addPiece(riser, step.level, step.x, step.y, levelElevation, -0.004);
  }
  // Lintels over low openings: from the clearance up to the top of the wall.
  for (const clearance of world.room.clearances ?? []) {
    const levelId = clearance.level ?? layout.baseLevel;
    const levelElevation = layout.level(levelId).elevation;
    if (clearance.height >= style.wallHeight) continue;
    for (const tile of clearance.tiles) {
      const lintel = drawBlock(projection, tile.x, tile.y, levelElevation + clearance.height, levelElevation + style.wallHeight, {
        top: style.wallTop,
        left: style.wallLeft,
        right: style.wallRight,
      });
      addPiece(lintel, levelId, tile.x, tile.y, levelElevation, 0);
    }
  }
  for (const level of layout.levels) {
    if (level.index === 0) continue;
    level.rows.forEach((row, tileY) =>
      [...row].forEach((character, tileX) => {
        if (character === "." && !layout.isStep(level.id, tileX, tileY)) {
          // Over something walkable (a doorway under a balcony, a room under a roof) it's a
          // slab; over nothing walkable it's solid all the way down (a porch, a plinth).
          const isOverWalkable = layout.levels.some(
            (lowerLevel) => lowerLevel.elevation < level.elevation && layout.walkable(lowerLevel.id, tileX, tileY),
          );
          const slabBottom = isOverWalkable ? level.elevation - style.slabThickness : 0;
          const slab = drawBlock(projection, tileX, tileY, slabBottom, level.elevation, {
            top: style.floorTop,
            left: style.floorSide[0],
            right: style.floorSide[1],
          });
          addPiece(slab, level.id, tileX, tileY, level.elevation, -0.004);
        } else if (character === "#") {
          const wall = drawBlock(projection, tileX, tileY, level.elevation - style.slabThickness, level.elevation + style.wallHeight, {
            top: style.wallTop,
            left: style.wallLeft,
            right: style.wallRight,
          });
          addPiece(wall, level.id, tileX, tileY, level.elevation, 0);
        }
      }),
    );
  }
  return pieces;
}

const approach = (current: number, target: number, maximumChange: number) =>
  current < target ? Math.min(target, current + maximumChange) : Math.max(target, current - maximumChange);

/**
 * Per-frame cutaway, shade and fog for a room's areas:
 * - pieces on cut-away tiles (and an interior's `cover` props) fade to `cutawayAlpha`
 * - a shade covers the room except the interior the player is in
 * - unrevealed areas have their floor under fog, and everything standing in them
 *   (props, furniture, actors) hidden; their walls stay, so you see a room's shape,
 *   not its contents, and the fog never covers anything behind it
 */
export class AreaEffects {
  #world: World;
  #fogLayer: Container;
  #look: AreaLook;
  #headroom: number;
  #pieces: RoomPiece[] = [];
  #fogByArea = new Map<string, Graphics[]>();
  #fogAlphaByArea = new Map<string, number>();
  #shade = new Graphics();
  #shadeHole = new Graphics();
  #shadeAlpha = 0;
  #shadeHoleArea: string | null = null;
  #shadeBounds = { x: 0, y: 0, width: 0, height: 0 };

  constructor(world: World, fogLayer: Container, shadeParent: Container, look: AreaLook) {
    this.#world = world;
    this.#fogLayer = fogLayer;
    this.#look = look;
    this.#headroom = look.headroom ?? 32;
    this.#shade.alpha = 0;
    this.#shade.setMask({ mask: this.#shadeHole, inverse: true });
    shadeParent.addChild(this.#shadeHole, this.#shade);
  }

  /** Forget the old room and set up fog for the new one. Pieces are added as the room builds. */
  reset(bounds: { x: number; y: number; width: number; height: number }, roomHeadroom: number): void {
    this.#headroom = this.#look.headroom ?? roomHeadroom;
    this.#pieces = [];
    for (const fogTiles of this.#fogByArea.values()) for (const fogTile of fogTiles) fogTile.destroy();
    this.#fogByArea.clear();
    this.#fogAlphaByArea.clear();
    this.#shadeAlpha = 0;
    this.#shade.alpha = 0;
    this.#shadeHoleArea = null;
    this.#shadeHole.clear();
    // Generous margin: raised levels and walls reach above the grid's bounds.
    const margin = Math.max(bounds.width, bounds.height);
    this.#shadeBounds = { x: bounds.x - margin, y: bounds.y - margin, width: bounds.width + margin * 2, height: bounds.height + margin * 2 };
    this.#shade.clear().rect(this.#shadeBounds.x, this.#shadeBounds.y, this.#shadeBounds.width, this.#shadeBounds.height).fill(this.#look.shadeColor);

    const world = this.#world;
    for (const area of world.layout.areas) {
      if ((area.reveal ?? "always") === "always") continue;
      const revealed = world.isAreaRevealed(area.id);
      const fogTiles = world.layout.areaTiles(area.id).map((tile) => {
        const elevation = world.layout.elevationAt(tile.level, tile.x, tile.y);
        // The floor only: what stands there is hidden separately, and walls stay visible.
        const fogTile = new Graphics().poly(tileOutline(world.projection, tile.x, tile.y, elevation)).fill(this.#look.fogColor);
        fogTile.alpha = revealed ? 0 : this.#look.fogAlpha;
        this.#fogLayer.addChild(fogTile);
        return fogTile;
      });
      this.#fogByArea.set(area.id, fogTiles);
      this.#fogAlphaByArea.set(area.id, revealed ? 0 : this.#look.fogAlpha);
    }
  }

  addPiece(piece: RoomPiece): void {
    this.#pieces.push(piece);
  }

  /** Whether a piece is cut away right now. */
  isCut(piece: RoomPiece, interior: AreaDef | null): boolean {
    if (!interior) return false;
    if (piece.propId && interior.cover?.includes(piece.propId)) return true;
    return piece.tiles.some((tile) => this.#world.isCutAway(piece.level, tile.x, tile.y));
  }

  /** Whether a piece stands in an area that isn't revealed yet (furniture in an unexplored room). */
  isHidden(piece: RoomPiece): boolean {
    return piece.tiles.some((tile) => {
      const area = this.#world.layout.areaAt(piece.level, tile.x, tile.y);
      return !!area && !this.#world.isAreaRevealed(area.id);
    });
  }

  /** Target alpha for something standing at a tile: faded if cut away. */
  get cutawayAlpha(): number {
    return this.#look.cutawayAlpha;
  }

  update(deltaMs: number): void {
    const world = this.#world;
    const fadeStep = deltaMs / Math.max(1, this.#look.fadeMs);
    const interior = world.cutaway();

    for (const piece of this.#pieces) {
      const targetAlpha = this.isHidden(piece) ? 0 : this.isCut(piece, interior) ? this.#look.cutawayAlpha : 1;
      piece.view.alpha = approach(piece.view.alpha, targetAlpha, fadeStep);
    }

    for (const [areaId, fogTiles] of this.#fogByArea) {
      const targetAlpha = world.isAreaRevealed(areaId) ? 0 : this.#look.fogAlpha;
      const fogAlpha = approach(this.#fogAlphaByArea.get(areaId) ?? targetAlpha, targetAlpha, fadeStep);
      this.#fogAlphaByArea.set(areaId, fogAlpha);
      for (const fogTile of fogTiles) {
        fogTile.alpha = fogAlpha;
        fogTile.visible = fogAlpha > 0.001;
      }
    }

    // Keep the last interior's hole while the shade fades out, so it doesn't snap.
    if (interior && interior.id !== this.#shadeHoleArea) this.#drawShadeHole(interior.id);
    this.#shadeAlpha = approach(this.#shadeAlpha, interior ? this.#look.shadeAlpha : 0, fadeStep * this.#look.shadeAlpha);
    this.#shade.alpha = this.#shadeAlpha;
    this.#shade.visible = this.#shadeAlpha > 0.001;
  }

  #drawShadeHole(areaId: string): void {
    const world = this.#world;
    this.#shadeHoleArea = areaId;
    this.#shadeHole.clear();
    for (const tile of world.layout.areaTiles(areaId)) {
      const elevation = world.layout.level(tile.level).elevation;
      this.#shadeHole.poly(tilePrism(world.projection, tile.x, tile.y, elevation, this.#headroom)).fill(0xffffff);
    }
  }

  destroy(): void {
    for (const fogTiles of this.#fogByArea.values()) for (const fogTile of fogTiles) fogTile.destroy();
    this.#shade.destroy();
    this.#shadeHole.destroy();
  }
}
