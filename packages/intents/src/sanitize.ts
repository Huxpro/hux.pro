// A drawing a model wrote is markup from outside: only shapes and paint survive.

const TAGS = new Set(["g", "path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "defs", "lineargradient", "radialgradient", "stop"]);
const ATTRS = new Set([
  "d", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "points", "x1", "y1", "x2", "y2",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity",
  "transform", "offset", "stop-color", "stop-opacity", "id", "gradientunits", "fx", "fy",
]);

/** Shapes and paint only: no script, no events, no links, no outside references. */
export function sanitizeSvg(svg: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`, "image/svg+xml");
  const root = doc.documentElement;
  if (root.querySelector("parsererror")) return "";
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!TAGS.has(child.localName.toLowerCase())) {
        child.remove();
        continue;
      }
      for (const a of [...child.attributes]) {
        const v = a.value.trim().toLowerCase();
        if (!ATTRS.has(a.name.toLowerCase()) || ((a.name === "fill" || a.name === "stroke") && v.startsWith("url(") && !/^url\(#[\w-]+\)$/.test(v))) child.removeAttribute(a.name);
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}
