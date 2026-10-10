// =============================================================================
// Measurement: where every semantic thing is, in scene units.
//
//   geometry   from the shapes themselves (SVG bounding boxes). Occlusion is
//              ignored: the man behind the door still has his whole box.
//   visible    from the pixels actually drawn. A copy of the scene is painted
//              once more into a "pick buffer": every semantic path one flat
//              colour, decoration (atmosphere) left out, no antialiasing. The
//              box of a colour is the box of what you can see of that thing.
//
// The pick buffer is what makes the measurement the same on every backend:
// SVG is cloned, recoloured and rasterised; canvas drawings are run again
// through a context that paints in the path's colour. Whatever the scene
// drew, and however, its pixels say whose they are.
// =============================================================================

import { isNode, prefixes } from "./path";
import type { Registry } from "./registry";

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Pixels (visible boxes), in scene units squared. */
  px: number;
}

export interface Pick {
  boxes: Map<string, Box>;
  /** Pixels that belong to some path, over pixels drawn at all (atmosphere aside). */
  coverage: number;
  /** Where the pixels nobody claims are, if any. */
  unclaimed: Box | null;
  /** For hit tests: scene point → path. */
  at: (x: number, y: number) => string | null;
}

/** Pick buffer resolution, relative to the scene's own units. */
export const PICK_SCALE = 1;

const grow = (map: Map<string, Box>, key: string, b: Omit<Box, "px">, px: number) => {
  const cur = map.get(key);
  if (!cur) map.set(key, { ...b, px });
  else {
    cur.x0 = Math.min(cur.x0, b.x0);
    cur.y0 = Math.min(cur.y0, b.y0);
    cur.x1 = Math.max(cur.x1, b.x1);
    cur.y1 = Math.max(cur.y1, b.y1);
    cur.px += px;
  }
};

/** Scene units → the svg's client pixels (what the viewer sees), as [a, b, c, d, e, f]. */
export function sceneToClient(svg: SVGSVGElement): [number, number, number, number, number, number] {
  const m = svg.getScreenCTM();
  const r = svg.getBoundingClientRect();
  if (!m) return [1, 0, 0, 1, 0, 0];
  // getScreenCTM is in viewport coordinates; make it relative to the svg's own box.
  return [m.a, m.b, m.c, m.d, m.e - r.left + svg.clientLeft, m.f - r.top + svg.clientTop];
}

// -----------------------------------------------------------------------------
// Geometry
// -----------------------------------------------------------------------------

const SHAPES = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text", "use", "image"]);
const PAINT_SERVERS = new Set(["defs", "clipPath", "mask", "pattern", "linearGradient", "radialGradient", "filter", "symbol", "marker"]);
const SHAPE_SELECTOR = [...SHAPES].join(",");
const PAINT_SERVER_SELECTOR = [...PAINT_SERVERS].join(",");

export function measureGeometry(svg: SVGSVGElement): Map<string, Box> {
  // Box by shape, owned by the nearest data-sem: a thing standing inside
  // another (the man in the wardrobe) is his own, and does not grow its host.
  const out = new Map<string, Box>();
  const m = svg.getScreenCTM();
  if (!m) return out;
  const inv = m.inverse();
  const toScene = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(inv);
  for (const el of svg.querySelectorAll<SVGGraphicsElement>(SHAPE_SELECTOR)) {
    if (el.closest("[data-sem-post]") || el.closest(PAINT_SERVER_SELECTOR)) continue;
    const owner = el.closest("[data-sem]")?.getAttribute("data-sem");
    if (!owner) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    const a = toScene(r.left, r.top);
    const b = toScene(r.right, r.bottom);
    const box = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
    for (const k of prefixes(owner)) if (isNode(k)) grow(out, k, box, 0);
  }
  return out;
}

// -----------------------------------------------------------------------------
// The pick buffer
// -----------------------------------------------------------------------------

const UNCLAIMED = [255, 0, 255] as const;
const colours = new Map<string, readonly [number, number, number]>();
const byColour = new Map<number, string>();

function colourFor(path: string): readonly [number, number, number] {
  let c = colours.get(path);
  if (!c) {
    const i = colours.size + 1;
    // Spread over the cube, never magenta (unclaimed), never black.
    c = [20 + ((i * 47) % 215), 20 + ((i * 89) % 215), 20 + ((i * 131) % 200)] as const;
    while (byColour.has((c[0] << 16) | (c[1] << 8) | c[2])) c = [c[0], c[1], (c[2] + 7) % 220 + 20] as const;
    colours.set(path, c);
    byColour.set((c[0] << 16) | (c[1] << 8) | c[2], path);
  }
  return c;
}
const css = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;


/** A copy of the scene's svg where every shape is its owner's flat colour. */
function pickSvg(svg: SVGSVGElement, w: number, h: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  const drop: Element[] = [];
  for (let i = 0; i < originals.length; i++) {
    const o = originals[i] as SVGElement;
    const c = copies[i] as SVGElement;
    if (o.closest(PAINT_SERVER_SELECTOR)) continue;
    if (o.hasAttribute("data-sem-post")) { drop.push(c); continue; }
    const cs = getComputedStyle(o);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.04) { drop.push(c); continue; }
    c.removeAttribute("class");
    c.removeAttribute("style");
    c.removeAttribute("filter");
    c.setAttribute("opacity", "1");
    if (!SHAPES.has(o.localName)) continue;
    const owner = o.closest("[data-sem]")?.getAttribute("data-sem");
    const colour = css(owner ? colourFor(owner) : UNCLAIMED);
    if (cs.fill !== "none" && parseFloat(cs.fillOpacity) >= 0.04) c.setAttribute("fill", colour);
    else c.setAttribute("fill", "none");
    if (cs.stroke !== "none" && parseFloat(cs.strokeOpacity) >= 0.04) c.setAttribute("stroke", colour);
    c.setAttribute("fill-opacity", "1");
    c.setAttribute("stroke-opacity", "1");
  }
  for (const d of drop) d.remove();
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
  clone.setAttribute("preserveAspectRatio", "none");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("shape-rendering", "crispEdges");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  return new XMLSerializer().serializeToString(clone);
}

/** A canvas context that paints everything in one colour and nothing translucent. */
function pickContext(ctx: CanvasRenderingContext2D, colour: string): CanvasRenderingContext2D {
  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.filter = "none";
  return new Proxy(ctx, {
    get(target, key) {
      if (key === "drawImage") {
        return (img: CanvasImageSource & { width: number; height: number }, ...a: number[]) => {
          const [dx, dy, dw, dh] =
            a.length >= 8 ? [a[4], a[5], a[6], a[7]] : a.length >= 4 ? [a[0], a[1], a[2], a[3]] : [a[0], a[1], img.width, img.height];
          target.fillStyle = colour;
          target.fillRect(dx, dy, dw, dh);
        };
      }
      const v = Reflect.get(target, key, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
    set(target, key, value) {
      if (key === "fillStyle" || key === "strokeStyle") { Reflect.set(target, key, colour, target); return true; }
      if (key === "globalAlpha") { target.globalAlpha = value >= 0.04 ? 1 : 0; return true; }
      if (key === "shadowBlur" || key === "shadowColor" || key === "filter" || key === "globalCompositeOperation") return true;
      return Reflect.set(target, key, value, target);
    },
  });
}

let pickCanvas: HTMLCanvasElement | null = null;

export async function measureVisible(svg: SVGSVGElement, registry: Registry, t: number): Promise<Pick> {
  const vb = svg.viewBox.baseVal;
  const W = Math.round(vb.width * PICK_SCALE);
  const H = Math.round(vb.height * PICK_SCALE);
  pickCanvas ??= document.createElement("canvas");
  pickCanvas.width = W;
  pickCanvas.height = H;
  const ctx = pickCanvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  // Retained: the svg, recoloured, rasterised.
  const url = URL.createObjectURL(new Blob([pickSvg(svg, W, H)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    ctx.drawImage(img, 0, 0, W, H);
  } finally {
    URL.revokeObjectURL(url);
  }

  // Immediate: every canvas drawing again, through the colouring context.
  for (const d of registry.draws) {
    ctx.save();
    ctx.setTransform(PICK_SCALE, 0, 0, PICK_SCALE, -vb.x * PICK_SCALE, -vb.y * PICK_SCALE);
    d.fn(pickContext(ctx, css(colourFor(d.path))), t);
    ctx.restore();
  }

  const data = ctx.getImageData(0, 0, W, H).data;
  const raw = new Map<string, Box>();
  const owner = new Array<string | null>(W * H).fill(null);
  let drawn = 0;
  let claimed = 0;
  let unclaimed: Box | null = null;
  const u = 1 / PICK_SCALE;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] < 250) continue;
      drawn++;
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      const b = { x0: vb.x + x * u, y0: vb.y + y * u, x1: vb.x + (x + 1) * u, y1: vb.y + (y + 1) * u };
      if (data[i] === UNCLAIMED[0] && data[i + 1] === UNCLAIMED[1] && data[i + 2] === UNCLAIMED[2]) {
        unclaimed = unclaimed
          ? { x0: Math.min(unclaimed.x0, b.x0), y0: Math.min(unclaimed.y0, b.y0), x1: Math.max(unclaimed.x1, b.x1), y1: Math.max(unclaimed.y1, b.y1), px: unclaimed.px + u * u }
          : { ...b, px: u * u };
        continue;
      }
      const path = byColour.get(key);
      if (!path) continue; // a blended edge (canvas antialiasing)
      claimed++;
      owner[y * W + x] = path;
      grow(raw, path, b, u * u);
    }
  }
  const boxes = new Map<string, Box>();
  for (const [path, b] of raw) for (const k of prefixes(path)) grow(boxes, k, b, b.px);

  return {
    boxes,
    coverage: drawn ? claimed / drawn : 1,
    unclaimed,
    at: (sx, sy) => {
      const x = Math.floor((sx - vb.x) * PICK_SCALE);
      const y = Math.floor((sy - vb.y) * PICK_SCALE);
      // A small neighbourhood, so a thin thing (an eye) can be hit.
      for (let r = 0; r <= 3; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
            const p = owner[Y * W + X];
            if (p) return p;
          }
      return null;
    },
  };
}
