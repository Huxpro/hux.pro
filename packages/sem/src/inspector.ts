// The inspector: every node's shape drawn over the page, whatever drew the
// node, and what the layer knows beside it. Plain DOM, no framework, so it can
// sit over any page.
//
// Two modes, switched by the button in the corner (or the ` key):
//
//   inspect   the page is held still under glass: a sheet over the whole
//             screen takes every touch, click and key, so nothing reaches the
//             page. A tap picks the topmost node under the finger; a second
//             tap on the same spot goes one deeper (a light, then the field of
//             lights, then the scene). Esc goes back to live.
//   live      the page works as usual; the shapes stay drawn. On a desk,
//             shift-click still picks, and the page never hears that click.

import { formatShape } from "./geometry";
import type { Layer } from "./layer";
import type { Backend, Shape } from "./types";

export type InspectorMode = "inspect" | "live";

/** Writes one param of one node back to its source; resolves to what it did, rejects with why not. */
export type Saver = (edit: { file: string; id: string; prop: string; value: unknown }) => Promise<string>;

export interface Inspector {
  mode(): InspectorMode;
  setMode(mode: InspectorMode): void;
  /** The picked node (`id` or a population's `id#i`), or null. */
  picked(): string | null;
  pick(id: string | null): void;
  unmount(): void;
}

const COLORS: Record<Backend, string> = {
  dom: "#4f8ff7",
  svg: "#b26cf6",
  canvas2d: "#f5a524",
  webgl: "#22c38e",
  none: "#9a9a9a",
};

/** Within this many px, a second tap is "the same spot", and goes one deeper. */
const SAME_SPOT = 10;
/** How far from a finger (or a mouse) a population's member can be and still be picked, px. */
const SLOP = { touch: 12, mouse: 3 };

/** JSON with its numbers rounded for reading. */
const readable = (v: unknown) =>
  JSON.stringify(v, (_, x) => (typeof x === "number" && !Number.isInteger(x) ? Math.round(x * 100) / 100 : x));

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

const chip = (id: string, on: boolean) =>
  `<span data-sem-pick="${escape(id)}" style="display:inline-block;margin:2px 4px 2px 0;padding:3px 7px;border-radius:6px;cursor:pointer;` +
  `background:${on ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.08)"}">${escape(id)}</span>`;

export function mountInspector(layer: Layer, options: { mode?: InspectorMode; save?: Saver } = {}): Inspector {
  let mode: InspectorMode = options.mode ?? "inspect";
  let picked: string | null = null;
  /** What was under the last tap, topmost first, and which of them is picked. */
  let stack: string[] = [];
  let lastTap: { x: number; y: number } | null = null;
  let pointer: { x: number; y: number } | null = null;
  let collapsed = false;
  let lastText = 0;

  const root = document.createElement("div");
  root.setAttribute("data-sem-inspector", "");
  root.style.cssText = "position:fixed;inset:0;z-index:2147483000;pointer-events:none;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.cssText = "position:absolute;inset:0;overflow:visible;";

  // The glass: in inspect mode it lies over the whole page and takes every touch.
  const glass = document.createElement("div");
  glass.style.cssText = "position:absolute;inset:0;touch-action:none;cursor:crosshair;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.style.cssText =
    "position:absolute;top:calc(env(safe-area-inset-top) + 8px);right:calc(env(safe-area-inset-right) + 8px);min-width:44px;min-height:44px;padding:0 14px;" +
    "pointer-events:auto;border-radius:22px;border:1px solid rgba(255,255,255,.2);font:inherit;font-size:12px;cursor:pointer;" +
    "-webkit-tap-highlight-color:transparent;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);";

  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;left:8px;bottom:calc(env(safe-area-inset-bottom) + 8px);width:min(560px,calc(100vw - 16px));box-sizing:border-box;max-height:42vh;overflow:auto;" +
    "pointer-events:auto;overscroll-behavior:contain;background:rgba(12,12,16,.9);color:#e8e8ec;border:1px solid rgba(255,255,255,.14);" +
    "border-radius:10px;padding:8px 10px;white-space:pre-wrap;word-break:break-word;";

  // The panel's text is rebuilt a few times a second; its controls only when the pick changes,
  // so a slider is never pulled out from under a finger.
  const headEl = document.createElement("div");
  const controlsEl = document.createElement("div");
  controlsEl.style.cssText = "white-space:normal;";
  const bodyEl = document.createElement("div");
  panel.append(headEl, controlsEl, bodyEl);
  root.append(svg, glass, panel, toggle);
  document.body.append(root);

  const paintMode = () => {
    const on = mode === "inspect";
    glass.style.pointerEvents = on ? "auto" : "none";
    glass.style.background = on ? "rgba(79,143,247,.06)" : "transparent";
    toggle.textContent = on ? "◎ inspect" : "▶ live";
    toggle.setAttribute("aria-pressed", String(on));
    toggle.title = on ? "Inspect mode: touches pick nodes. Tap (or Esc, or `) for live." : "Live: the page works. Tap (or `) to inspect.";
    toggle.style.background = on ? "rgba(79,143,247,.9)" : "rgba(12,12,16,.8)";
    toggle.style.color = on ? "#fff" : "#e8e8ec";
    lastText = 0;
  };

  const pickAt = (x: number, y: number, slop: number) => {
    const hits = layer.at(x, y, undefined, { slop });
    // Things move (a globe turns, a ring appears): the same spot is the same
    // nodes, whichever of their members happen to be under it now.
    const node = (id: string) => id.split("#")[0];
    const nodes = (ids: string[]) => [...new Set(ids.map(node))].sort().join();
    const same = lastTap && picked && Math.hypot(lastTap.x - x, lastTap.y - y) <= SAME_SPOT && nodes(hits) === nodes(stack);
    stack = hits;
    let next = 0;
    if (same) {
      const at = stack.includes(picked!) ? stack.indexOf(picked!) : stack.findIndex((id) => node(id) === node(picked!));
      next = (at + 1) % Math.max(1, stack.length);
    }
    picked = stack[next] ?? null;
    lastTap = { x, y };
    lastText = 0;
  };

  // Inspect mode: the glass takes the touch. Nothing under it hears anything.
  const onGlassDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pickAt(e.clientX, e.clientY, e.pointerType === "mouse" ? SLOP.mouse : SLOP.touch);
  };
  const onGlassMove = (e: PointerEvent) => {
    pointer = e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : null;
  };
  glass.addEventListener("pointerdown", onGlassDown);
  glass.addEventListener("pointermove", onGlassMove);
  glass.addEventListener("pointerleave", () => (pointer = null));
  glass.addEventListener("contextmenu", (e) => e.preventDefault());

  // Live mode: hover outlines; shift-click picks and the page never hears it.
  const inside = (e: Event) => root.contains(e.target as Node);
  const onLiveMove = (e: PointerEvent) => {
    if (mode === "live" && e.pointerType === "mouse") pointer = { x: e.clientX, y: e.clientY };
  };
  const onLiveDown = (e: PointerEvent) => {
    if (mode !== "live" || !e.shiftKey || inside(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pickAt(e.clientX, e.clientY, SLOP.mouse);
  };
  const swallowShift = (e: Event) => {
    if (mode === "live" && (e as PointerEvent).shiftKey && !inside(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  // Keys: ` switches modes anywhere; in inspect mode the page hears no key at all.
  const onKey = (e: KeyboardEvent) => {
    // The panel's own controls keep their keys (a slider's arrows).
    if (inside(e) && e.key !== "`") return;
    if (e.key === "`") {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === "keydown" && !e.repeat) setMode(mode === "inspect" ? "live" : "inspect");
      return;
    }
    if (mode !== "inspect") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === "keydown" && e.key === "Escape") setMode("live");
  };
  window.addEventListener("pointermove", onLiveMove, true);
  window.addEventListener("pointerdown", onLiveDown, true);
  window.addEventListener("pointerup", swallowShift, true);
  window.addEventListener("click", swallowShift, true);
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("keyup", onKey, true);

  toggle.addEventListener("click", () => setMode(mode === "inspect" ? "live" : "inspect"));
  // The panel is rebuilt a few times a second, so it acts on the press, not the click.
  panel.addEventListener("pointerdown", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-sem-pick],[data-sem-toggle]");
    if (!target) return;
    e.preventDefault();
    if (target.dataset.semToggle !== undefined) collapsed = !collapsed;
    else picked = target.dataset.semPick ?? null;
    lastText = 0;
  });

  // --- the picked node's knobs ----------------------------------------------
  let controlsFor: string | null = null;
  const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

  function renderControls() {
    controlsEl.replaceChildren();
    const id = picked?.split("#")[0] ?? null;
    controlsFor = id;
    const decl = id ? layer.get(id) : undefined;
    const node = id ? layer.select(id)?.node : undefined;
    if (!decl?.set || !node?.params) return;
    const numeric = Object.entries(node.params).filter(([, p]) => typeof p.value === "number");
    if (!numeric.length) return;
    const original: Record<string, number> = {};
    const dirty: Record<string, number> = {};
    const box = document.createElement("div");
    box.style.cssText = "margin-top:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,.06);";
    const status = document.createElement("div");
    status.style.cssText = "opacity:.7;margin-top:6px;white-space:pre-wrap;";
    const save = document.createElement("button");
    const reset = document.createElement("button");
    for (const b of [save, reset]) {
      b.type = "button";
      b.style.cssText =
        "font:inherit;color:inherit;background:rgba(255,255,255,.12);border:0;border-radius:6px;padding:6px 10px;margin-right:6px;cursor:pointer;min-height:32px;";
    }
    save.textContent = decl.edit ? "save to source" : "no source to save to";
    reset.textContent = "reset";
    const paintButtons = () => {
      const n = Object.keys(dirty).length;
      save.disabled = !n || !decl.edit || !options.save;
      reset.disabled = !n;
      save.style.opacity = save.disabled ? ".4" : "1";
      reset.style.opacity = reset.disabled ? ".4" : "1";
    };
    for (const [k, p] of numeric) {
      const value = p.value as number;
      original[k] = value;
      const [min, max] = p.range ?? [0, Math.max(1, value * 2)];
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:2px 0;";
      const name = document.createElement("span");
      name.textContent = p.live === false ? `${k} ↻` : k;
      if (p.live === false) name.title = "applies when it starts again";
      name.style.cssText = "min-width:72px;";
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String((max - min) / 200);
      input.value = String(value);
      input.style.cssText = "flex:1;min-width:0;height:28px;";
      const out = document.createElement("span");
      out.style.cssText = "min-width:64px;text-align:right;";
      out.textContent = `${fmt(value)}${p.unit ?? ""}`;
      input.addEventListener("input", () => {
        const v = Number(input.value);
        decl.set!(k, v);
        dirty[k] = v;
        out.textContent = `${fmt(v)}${p.unit ?? ""}`;
        status.textContent = "";
        paintButtons();
      });
      row.append(name, input, out);
      box.append(row);
    }
    save.addEventListener("click", async () => {
      if (!decl.edit || !options.save) return;
      const lines: string[] = [];
      for (const [k, v] of Object.entries(dirty)) {
        const value = Number(fmt(v));
        try {
          lines.push(`✓ ${await options.save({ file: decl.edit.file, id: decl.edit.id, prop: k, value })}`);
          delete dirty[k];
        } catch (error) {
          // Not saved (a production build has no write route): the command that would.
          lines.push(`✗ ${(error as Error).message}\n  pnpm scene:patch ${decl.edit.file} ${decl.edit.id} ${k} ${value}`);
        }
      }
      status.textContent = lines.join("\n");
      paintButtons();
    });
    reset.addEventListener("click", () => {
      for (const k of Object.keys(dirty)) decl.set!(k, original[k]);
      renderControls();
    });
    const buttons = document.createElement("div");
    buttons.style.cssText = "margin-top:6px;";
    buttons.append(save, reset);
    box.append(buttons, status);
    controlsEl.append(box);
    paintButtons();
  }

  let raf = 0;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const snap = layer.snapshot();
    const hover = pointer ? layer.at(pointer.x, pointer.y, snap, { slop: SLOP.mouse })[0] : undefined;
    const focus = new Set([hover?.split("#")[0], picked?.split("#")[0]]);
    const marks: string[] = [];
    for (const id of snap.order) {
      const node = snap.nodes[id];
      if (!node.shape) continue;
      const color = COLORS[node.backend];
      const on = focus.has(id);
      const dash = node.visible ? "" : `stroke-dasharray="3 3"`;
      marks.push(
        svgShape(node.shape, `fill="${on ? color + "26" : "none"}" stroke="${color}" stroke-width="${on ? 2.5 : 1}" ${dash} opacity="${node.visible ? 0.95 : 0.4}"`),
      );
      if (node.bounds && (on || node.visible)) {
        const x = Math.max(2, node.bounds.x + 2);
        const y = Math.max(10, node.bounds.y + 10);
        marks.push(`<text x="${x}" y="${y}" fill="${color}" font-size="10" paint-order="stroke" stroke="rgba(0,0,0,.75)" stroke-width="3">${escape(id)}</text>`);
      }
    }
    // A population's member, hovered or picked, outlined on its own.
    for (const ref of [hover, picked]) {
      if (!ref?.includes("#")) continue;
      const [id, i] = ref.split("#");
      const item = layer.get(id)?.item?.(Number(i));
      if (item) marks.push(svgShape(item, `fill="rgba(255,255,255,.25)" stroke="#fff" stroke-width="1.5"`));
    }
    if (mode === "inspect" && lastTap) {
      marks.push(`<circle cx="${lastTap.x}" cy="${lastTap.y}" r="5" fill="none" stroke="#fff" stroke-width="1.5" opacity=".8"/>`);
    }
    svg.innerHTML = marks.join("");

    if ((picked?.split("#")[0] ?? null) !== controlsFor) renderControls();

    // The text is for reading, not animating: a few times a second is plenty.
    if (t - lastText < 300) return;
    lastText = t;
    const hint = mode === "inspect" ? "tap to pick · tap again to go deeper" : "the page is live · shift-click picks";
    const head = `<span data-sem-toggle style="cursor:pointer">${collapsed ? "▸" : "▾"} sem</span>  <span style="opacity:.6">${hint}</span>`;
    headEl.innerHTML = head;
    controlsEl.style.display = bodyEl.style.display = collapsed ? "none" : "";
    if (collapsed) return;
    let body = "";
    const selection = picked ? layer.select(picked, snap) : null;
    if (selection) {
      const { node, member, linked, checks, children } = selection;
      const path = [...selection.ancestors].reverse().map((a) => a.id);
      const where = member ? member.shape : node.shape;
      body +=
        `\n\n<b style="color:${COLORS[node.backend]}">${escape(picked!)}</b>${member?.name ? ` <b>${escape(member.name)}</b>` : ""}  ` +
        `${escape(node.kind)}·${node.backend}  ${where ? formatShape(where) : "off-screen"}${node.visible ? "" : " (hidden)"}` +
        (member ? `\n<span style="opacity:.6">one of</span> ${chip(node.id, false)}` : "") +
        `\n<span style="opacity:.6">in</span> ${path.map((id) => chip(id, false)).join("") || "-"}` +
        (children.length ? `\n<span style="opacity:.6">has</span> ${children.map((id) => chip(id, false)).join("")}` : "") +
        `\n<span style="opacity:.6">intent</span> ${escape(node.intent)}` +
        (node.names ? `\n<span style="opacity:.6">names</span> ${escape(node.names.join(", "))}` : "") +
        (node.state ? `\n<span style="opacity:.6">state</span> ${escape(readable(node.state))}` : "") +
        (node.count !== undefined ? `\n<span style="opacity:.6">count</span> ${node.count}` : "") +
        (node.source ? `\n<span style="opacity:.6">source</span> ${escape(node.source.file)}${node.source.symbols ? " → " + escape(node.source.symbols.join(", ")) : ""}` : "") +
        Object.entries(node.params ?? {})
          .map(([k, p]) => `\n  ${k} = ${escape(String(p.value))}${p.unit ?? ""}${p.range ? ` [${p.range.join("–")}]` : ""}${p.note ? `  <span style="opacity:.6">${escape(p.note)}</span>` : ""}`)
          .join("") +
        linked.map((l) => `\n  ${l.direction === "out" ? "→" : "←"} ${l.rel} ${chip(l.node.id, false)}`).join("") +
        checks.map((c) => `\n  ${c.ok ? "✓" : "✗"} ${escape(c.text)}${c.reason ? ` <span style="opacity:.6">(${escape(c.reason)})</span>` : ""}`).join("");
      if (stack.length > 1) body += `\n<span style="opacity:.6">under the tap</span> ${stack.map((id) => chip(id, id === picked)).join("")}`;
    }
    body += `\n\n${escape(layer.outline(snap))}`;
    bodyEl.innerHTML = body;
  };

  function setMode(next: InspectorMode) {
    mode = next;
    pointer = null;
    paintMode();
  }

  paintMode();
  raf = requestAnimationFrame(frame);

  return {
    mode: () => mode,
    setMode,
    picked: () => picked,
    pick(id) {
      picked = id;
      lastText = 0;
    },
    unmount() {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onLiveMove, true);
      window.removeEventListener("pointerdown", onLiveDown, true);
      window.removeEventListener("pointerup", swallowShift, true);
      window.removeEventListener("click", swallowShift, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      root.remove();
    },
  };
}
