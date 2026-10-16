// =============================================================================
// ② The model: what an event no preset could read is handed to.
//
//   infer(state, event) → Promise<Inference>
//
// It is shown what a ReAct step would show it (`observation`: the tree as
// text, the context, the event) and answers with a new tree (it may add a
// kind to an intent, or a thing with its own intents), the person's part of
// the event as a decision on it, or a question when it cannot tell. The
// tree comes back through `replace`, the same one-way door as everything else.
//
// Here it is a stand-in, local and recorded, so the Lab calls no model and
// runs offline: it knows a few things (a place he was dropped, an opening the
// door was left at, a lamp, "farther away"), and says so when it does not.
// A real model implements the same function; nothing else changes.
// =============================================================================

import type { Event } from "./recognize";
import { toXml, type Action, type Intent, type Kind, type Node, type Pt, type State, type Tree } from "./tree";

export interface Inference {
  tree?: Tree;
  /** The person's part of the event, as a decision on the new tree. */
  then?: Action[];
  /** One line: what the model made of it. */
  note: { zh: string; en: string };
  /** Something it now wants drawn (a lazy effect): the id of the thing. */
  draw?: string;
  /** What it was shown. */
  observation: string;
}

export const LATENCY = 900;

/** What a model is shown for an event: the tree, the context, what just happened. */
export function observe(state: State, ev: Event): string {
  const what =
    ev.type === "drag" && ev.target === "man"
      ? `<drag target="man" to="${ev.to.map((v) => Math.round(v)).join(",")}" />`
      : ev.type === "drag" && ev.target === "door"
        ? `<drag target="wardrobe.door" open="${ev.open.toFixed(2)}" />`
        : ev.type === "prompt"
          ? `<prompt on="${ev.node ?? "scene"}">${ev.text}</prompt>`
          : `<resize />`;
  const prompts = state.ctx.prompts.map((p) => `  <said>${p}</said>`).join("\n");
  return `${toXml(state)}\n<context>\n${prompts}\n</context>\n${what}\n<!-- No preset intent reads this event. Return the tree, changed as little as it takes. -->`;
}

/** He is smaller the farther back he stands: a scale from the floor line. */
const depth = (y: number) => Math.max(0.6, Math.min(1.95, 0.72 + ((y - 600) / 272) * 1.2));

const withKind = (tree: Tree, node: string, intent: string, id: string, kind: Kind, p: number): Tree => ({
  ...tree,
  nodes: tree.nodes.map((n) => {
    if (n.id !== node) return n;
    const i = n.intents[intent];
    // The new kind takes p; the others keep their proportions in what is left.
    const rest = Object.fromEntries(Object.entries(i.p).map(([k, v]) => [k, v * (1 - p)]));
    const next: Intent = { ...i, kinds: { ...i.kinds, [id]: { ...kind, learned: true } }, p: { ...rest, [id]: p } };
    return { ...n, intents: { ...n.intents, [intent]: next } };
  }),
});

let seq = 0;

export async function infer(state: State, ev: Event, edge?: { node: string; intent: string; dir: 1 | -1 }): Promise<Inference> {
  const observation = observe(state, ev);
  await new Promise((r) => setTimeout(r, LATENCY));

  if (edge) {
    // Past the end of a scale ("帽子再大一点" when it is already absurd): one more kind, further along.
    const intent = state.tree.nodes.find((n) => n.id === edge.node)!.intents[edge.intent];
    const ks = Object.keys(intent.kinds);
    const last = intent.kinds[ks[edge.dir > 0 ? ks.length - 1 : 0]];
    const id = `${edge.intent}${edge.dir > 0 ? "+" : "-"}${ks.length}`;
    const realize =
      last.realize.hatScale !== undefined
        ? { hatScale: +(last.realize.hatScale * (edge.dir > 0 ? 1.25 : 0.8)).toFixed(2) }
        : { open: Math.max(0, Math.min(1, (last.realize.open ?? 0) + 0.15 * edge.dir)) };
    const label = edge.dir > 0 ? { zh: `比「${last.label.zh}」还大`, en: `beyond ${last.label.en}` } : { zh: `比「${last.label.zh}」还小`, en: `short of ${last.label.en}` };
    const kinds = edge.dir > 0 ? { ...intent.kinds, [id]: { label, realize, learned: true } } : { [id]: { label, realize, learned: true }, ...intent.kinds };
    const tree: Tree = {
      ...state.tree,
      nodes: state.tree.nodes.map((n) =>
        n.id !== edge.node ? n : { ...n, intents: { ...n.intents, [edge.intent]: { ...intent, kinds, p: { ...Object.fromEntries(Object.entries(intent.p).map(([k, v]) => [k, v * 0.2])), [id]: 0.8 } } } },
      ),
    };
    return {
      observation,
      tree,
      then: [{ type: "decide", node: edge.node, intent: edge.intent, kind: id, from: "said" }],
      note: { zh: `已经是最${edge.dir > 0 ? "大" : "小"}的一种了：在这个尺度的尽头再加一种（${label.zh}）`, en: `Already the ${edge.dir > 0 ? "largest" : "smallest"} kind: one more at the end of the scale (${label.en})` },
    };
  }

  if (ev.type === "drag" && ev.target === "man") {
    const [x, y] = ev.to;
    const where =
      y < 610
        ? { zh: "房间深处", en: "far back" }
        : x > 300 && y > 700
          ? { zh: "床尾", en: "at the foot of the bed" }
          : x < 150
            ? { zh: "窗下", en: "under the window" }
            : { zh: "房间中间", en: "in the middle of the room" };
    const id = `spot${++seq}`;
    const at: Pt = [Math.round(x), Math.round(y)];
    return {
      observation,
      tree: withKind(state.tree, "man", "place", id, { label: where, aka: [where.zh], realize: { at, scale: depth(y), lean: x < 195 ? 1.5 : -1.5 } }, 0.8),
      then: [{ type: "decide", node: "man", intent: "place", kind: id, from: "dragged" }],
      note: { zh: `一个新的位置：${where.zh}（离他知道的几个位置都太远），近大远小，比例 ${depth(y).toFixed(2)}`, en: `A new place: ${where.en} (too far from the ones it knew), scaled by depth to ${depth(y).toFixed(2)}` },
    };
  }

  if (ev.type === "drag" && ev.target === "door") {
    const pct = Math.round(ev.open * 100);
    const id = `open${pct}`;
    return {
      observation,
      tree: withKind(state.tree, "wardrobe", "door", id, { label: { zh: `开到 ${pct}%`, en: `${pct}% open` }, realize: { open: ev.open } }, 0.8),
      then: [{ type: "decide", node: "wardrobe", intent: "door", kind: id, from: "dragged" }],
      note: { zh: `柜门停在两种之间：记成一种新的开法（${pct}%），以后也能说出来`, en: `The door stopped between two kinds: a new one (${pct}%), nameable from now on` },
    };
  }

  if (ev.type === "prompt") {
    const t = ev.text.toLowerCase();
    if (/灯|lamp|light/.test(t)) {
      const lamp: Node = {
        id: "lamp",
        learned: true,
        label: { zh: "灯", en: "the lamp" },
        aka: ["灯", "台灯", "lamp", "light"],
        prompt: ev.text,
        intents: {
          place: {
            label: { zh: "放在哪", en: "where it is" },
            aka: ["放", "挪", "put", "move"],
            kinds: {
              nightstand: { label: { zh: "床头柜上", en: "on the nightstand" }, aka: ["床头柜", "床边"], realize: { at: [346, 742], scale: 1 } },
              floor: { label: { zh: "地上", en: "on the floor" }, aka: ["地上", "地板", "floor"], realize: { at: [56, 776], scale: 1.25 } },
            },
            p: { nightstand: 0.82, floor: 0.18 },
            resolve: "switch",
          },
          light: {
            label: { zh: "亮不亮", en: "on or off" },
            aka: ["亮", "开灯", "关灯", "light"],
            kinds: {
              on: { label: { zh: "亮着", en: "on" }, aka: ["开灯", "亮着", "打开灯", "on"], realize: { on: true } },
              off: { label: { zh: "关着", en: "off" }, aka: ["关灯", "熄", "off"], realize: { on: false } },
            },
            p: { on: 0.86, off: 0.14 },
            resolve: "switch",
          },
        },
      };
      return {
        observation,
        tree: { ...state.tree, nodes: [...state.tree.nodes.filter((n) => n.id !== "lamp"), lamp] },
        note: { zh: "树里没有灯：加一样新东西，带两个意图（放在哪、亮不亮）；它的样子要画，先用占位", en: "No lamp in the tree: a new thing with two intents (where, on or off); its look must be drawn, a placeholder till then" },
        draw: "lamp",
      };
    }
    if (/远|退后|后面|深处|far|back/.test(t)) {
      return {
        observation,
        tree: withKind(state.tree, "man", "place", "far", { label: { zh: "房间深处", en: "far back" }, aka: ["远", "深处", "far"], realize: { at: [250, 598], scale: 0.7, lean: 0 } }, 0.85),
        then: [{ type: "decide", node: "man", intent: "place", kind: "far", from: "said" }],
        note: { zh: "「远一点」不是任何一个已有的位置：加一个更远、更小的", en: "\"Farther\" is none of the places it knew: a new one, farther and smaller" },
      };
    }
  }

  return {
    observation,
    note: { zh: "模型也读不懂：树不变（真实的模型会在这里提问）", en: "The model cannot read it either: the tree stays (a real one would ask here)" },
  };
}
