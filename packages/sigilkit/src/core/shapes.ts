import type { Shape, Vec2 } from "./types";

export function pointInShape(shape: Shape, p: Vec2): boolean {
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
  }
  // Even-odd ray cast over a flat [x0, y0, x1, y1, ...] polygon.
  const pts = shape.polygon;
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]!, yi = pts[i + 1]!, xj = pts[j]!, yj = pts[j + 1]!;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Centre of a shape's bounding box; used to face toward a hotspot. */
export function shapeCenter(shape: Shape): Vec2 {
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return { x: x + w / 2, y: y + h / 2 };
  }
  const pts = shape.polygon;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]!);
    maxX = Math.max(maxX, pts[i]!);
    minY = Math.min(minY, pts[i + 1]!);
    maxY = Math.max(maxY, pts[i + 1]!);
  }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}
