// Geometry on sem's shapes: bounds, hit tests, overlap. Pure, so the same
// functions run in the browser, in the inspector and in a Node test.

import type { Rect, Shape } from "./types";

export function bounds(shape: Shape): Rect {
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return { x, y, w, h };
  }
  if ("circle" in shape) {
    const [cx, cy, r] = shape.circle;
    return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
  }
  const p = shape.poly;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i + 1 < p.length; i += 2) {
    x0 = Math.min(x0, p[i]);
    x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]);
    y1 = Math.max(y1, p[i + 1]);
  }
  return x0 === Infinity ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function translate(shape: Shape, dx: number, dy: number): Shape {
  if (dx === 0 && dy === 0) return shape;
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return { rect: [x + dx, y + dy, w, h] };
  }
  if ("circle" in shape) {
    const [cx, cy, r] = shape.circle;
    return { circle: [cx + dx, cy + dy, r] };
  }
  return { poly: shape.poly.map((v, i) => v + (i % 2 ? dy : dx)) };
}

export function contains(shape: Shape, x: number, y: number): boolean {
  if ("rect" in shape) {
    const [rx, ry, w, h] = shape.rect;
    return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  }
  if ("circle" in shape) {
    const [cx, cy, r] = shape.circle;
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  }
  // Even-odd ray cast.
  const p = shape.poly;
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i];
    const yi = p[i + 1];
    const xj = p[j];
    const yj = p[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Whether two shapes share any area. Exact for rects and circles in any
 * pairing; a polygon is taken at its bounds, which can only over-report.
 */
export function overlaps(a: Shape, b: Shape): boolean {
  if ("circle" in a && "circle" in b) {
    const [ax, ay, ar] = a.circle;
    const [bx, by, br] = b.circle;
    return (ax - bx) ** 2 + (ay - by) ** 2 < (ar + br) ** 2;
  }
  if ("circle" in a || "circle" in b) {
    const c = ("circle" in a ? a : b) as Extract<Shape, { circle: unknown }>;
    const other = c === a ? b : a;
    const [cx, cy, r] = c.circle;
    const box = bounds(other);
    const nx = Math.max(box.x, Math.min(cx, box.x + box.w));
    const ny = Math.max(box.y, Math.min(cy, box.y + box.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }
  return rectsOverlap(bounds(a), bounds(b));
}

/** Whether `inner`'s bounds lie within `outer`'s, give or take `slack` px. */
export function within(inner: Shape, outer: Shape, slack = 0.5): boolean {
  const a = bounds(inner);
  const b = bounds(outer);
  return a.x >= b.x - slack && a.y >= b.y - slack && a.x + a.w <= b.x + b.w + slack && a.y + a.h <= b.y + b.h + slack;
}

/** The vertical gap from the bottom of `upper` to the top of `lower`; negative when they overlap. */
export function gapBelow(upper: Shape, lower: Shape): number {
  const a = bounds(upper);
  const b = bounds(lower);
  return b.y - (a.y + a.h);
}

const n = (v: number) => String(Math.round(v));

/** A shape as one short line: `rect(0,24,390,14)`, `circle(195,422,164)`. */
export function formatShape(shape: Shape): string {
  if ("rect" in shape) return `rect(${shape.rect.map(n).join(",")})`;
  if ("circle" in shape) return `circle(${shape.circle.map(n).join(",")})`;
  const b = bounds(shape);
  return `poly[${shape.poly.length / 2}](${[b.x, b.y, b.w, b.h].map(n).join(",")})`;
}
