// The inspector: every node's shape drawn over the page, whatever drew the
// node, and the outline beside it. Plain DOM, no framework, so it can sit
// over any page. Pointer events pass through to the page; shift-click picks
// the node under the pointer instead, and the panel shows what `select()`
// returns for it.

import { formatShape } from "./geometry";
import type { Layer } from "./layer";
import type { Backend, Shape } from "./types";

const COLORS: Record<Backend, string> = {
  dom: "#4f8ff7",
  svg: "#b26cf6",
  canvas2d: "#f5a524",
  webgl: "#22c38e",
  none: "#9a9a9a",
};

const svgShape = (shape: Shape, attrs: string) => {
  if ("rect" in shape) {
    const [x, y, w, h] = shape.rect;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
  }
  if ("circle" in shape) {
    const [cx, cy, r] = shape.circle;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`;
  }
  return `<polygon points="${shape.poly.join(" ")}" ${attrs}/>`;
};

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function mountInspector(layer: Layer): () => void {
  const root = document.createElement("div");
  root.setAttribute("data-sem-inspector", "");
  root.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.cssText = "position:absolute;inset:0;overflow:visible;";
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;left:8px;bottom:8px;max-width:min(560px,calc(100vw - 16px));max-height:45vh;overflow:auto;pointer-events:auto;" +
    "background:rgba(12,12,16,.86);color:#e8e8ec;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;white-space:pre;";
  root.append(svg, panel);
  document.body.append(root);

  let pointer: { x: number; y: number } | null = null;
  let picked: string | null = null;
  let collapsed = false;
  let lastText = 0;

  const onMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY };
  };
  // Shift-click picks; the page never hears it.
  const onDown = (e: PointerEvent) => {
    if (!e.shiftKey || panel.contains(e.target as Node)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    picked = layer.at(e.clientX, e.clientY)[0] ?? null;
    lastText = 0;
  };
  const swallow = (e: Event) => {
    if ((e as PointerEvent).shiftKey && !panel.contains(e.target as Node)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("pointerup", swallow, true);
  window.addEventListener("click", swallow, true);
  panel.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).dataset.semToggle !== undefined) {
      collapsed = !collapsed;
      lastText = 0;
    }
  });

  let raf = 0;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const snap = layer.snapshot();
    const hover = pointer ? layer.at(pointer.x, pointer.y, snap)[0] : undefined;
    const focus = (hover ?? "").split("#")[0];
    const marks: string[] = [];
    for (const id of snap.order) {
      const node = snap.nodes[id];
      if (!node.shape) continue;
      const color = COLORS[node.backend];
      const on = id === focus || id === picked?.split("#")[0];
      const dash = node.visible ? "" : `stroke-dasharray="3 3"`;
      marks.push(svgShape(node.shape, `fill="${on ? color + "22" : "none"}" stroke="${color}" stroke-width="${on ? 2 : 1}" ${dash} opacity="${node.visible ? 0.9 : 0.4}"`));
      if (node.bounds && (on || node.visible)) {
        const x = Math.max(2, node.bounds.x + 2);
        const y = Math.max(10, node.bounds.y + 10);
        marks.push(`<text x="${x}" y="${y}" fill="${color}" font-size="10" paint-order="stroke" stroke="rgba(0,0,0,.7)" stroke-width="3">${escape(id)}</text>`);
      }
    }
    // A hovered population member, outlined on its own.
    if (hover?.includes("#")) {
      const [id, i] = hover.split("#");
      const decl = layer.get(id);
      const item = decl?.item?.(Number(i));
      if (item) marks.push(svgShape(item, `fill="none" stroke="#fff" stroke-width="1.5"`));
    }
    svg.innerHTML = marks.join("");

    // The text is for reading, not animating: a few times a second is plenty.
    if (t - lastText < 300) return;
    lastText = t;
    const head = `<span data-sem-toggle style="cursor:pointer;opacity:.7">${collapsed ? "▸" : "▾"} sem</span>  <span style="opacity:.55">hover to see · shift-click to pick${hover ? `  ·  ${escape(hover)}` : ""}</span>`;
    if (collapsed) {
      panel.innerHTML = head;
      return;
    }
    let body = "\n" + escape(layer.outline(snap));
    const selection = picked ? layer.select(picked, snap) : null;
    if (selection) {
      const { node, linked, checks } = selection;
      body +=
        `\n\n<b>${escape(picked!)}</b>  ${escape(node.kind)}·${node.backend}  ${node.shape ? formatShape(node.shape) : "off-screen"}` +
        `\nintent: ${escape(node.intent)}` +
        (node.names ? `\nnames: ${escape(node.names.join(", "))}` : "") +
        (node.source ? `\nsource: ${escape(node.source.file)}${node.source.symbols ? " → " + escape(node.source.symbols.join(", ")) : ""}` : "") +
        Object.entries(node.params ?? {})
          .map(([k, p]) => `\n  ${k} = ${p.value}${p.unit ?? ""}${p.range ? ` [${p.range.join("–")}]` : ""}${p.note ? `  ${escape(p.note)}` : ""}`)
          .join("") +
        linked.map((l) => `\n  ${l.direction === "out" ? "→" : "←"} ${l.rel} ${escape(l.node.id)}`).join("") +
        checks.map((c) => `\n  ${c.ok ? "✓" : "✗"} ${escape(c.text)}`).join("");
    }
    panel.innerHTML = head + body;
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("pointerup", swallow, true);
    window.removeEventListener("click", swallow, true);
    root.remove();
  };
}
