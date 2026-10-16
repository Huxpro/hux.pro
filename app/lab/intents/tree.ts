// =============================================================================
// DATA: the intent tree, the one source of truth.
//
// A model wrote it from the dream (MODEL_TREE below, recorded): the things in
// the scene, and on each, a few intents. An intent is a closed set of kinds,
// each kind carrying what it means in the picture (where he stands, how far
// the door is open), the model's belief over them, and, when a person has
// said, their pick. Everything else (coordinates, what is drawn) is computed
// from it; nothing computed is stored.
//
//   reduce(state, action)    decide · forget · replace · context
//
// `replace` is how a model's new tree comes in (after it has looked at an
// event no preset could read): reconciled by key like React's children, so a
// person's picks survive wherever their intent and kind still exist.
// =============================================================================

export type Pt = readonly [number, number];

/** What a kind means in the picture. Each intent reads the fields it needs. */
export interface Realize {
  at?: Pt;
  scale?: number;
  lean?: number;
  inside?: boolean;
  hatScale?: number;
  eyes?: number;
  open?: number;
  on?: boolean;
}

export interface Kind {
  label: { zh: string; en: string };
  aka?: readonly string[];
  /** Added by a model after an event, not in the tree it first wrote. */
  learned?: boolean;
  realize: Realize;
}

export interface Intent {
  label: { zh: string; en: string };
  /** Words that name the intent itself ("帽子", "门"). */
  aka: readonly string[];
  /** Kinds in order: "bigger" moves right, "smaller" left. */
  kinds: Record<string, Kind>;
  /** The model's belief over the kinds. */
  p: Record<string, number>;
  /** The kinds are a scale (a hat's size, a door's opening): "bigger" and "smaller" move along it. */
  ordered?: boolean;
  /** When the model is unsure: ask the person, or pick and offer the rest. */
  resolve: "ask" | "switch";
  /** A person's pick, and how they made it. */
  pick?: string;
  from?: "dragged" | "said" | "answered" | "switched";
}

export interface Node {
  id: string;
  label: { zh: string; en: string };
  aka: readonly string[];
  /** The words this thing came from. A reprompt adds to them. */
  prompt: string;
  intents: Record<string, Intent>;
  /** Written by a model after an event. */
  learned?: boolean;
}

export interface Tree {
  nodes: Node[];
  /** The framing, when a person has switched it: reintent's crossover ({ base, below, at }). */
  frame?: { pick: unknown; from: string };
}

/** Context: what the tree is seen in. Not the tree: changing it recomputes, it decides nothing. */
export interface Context {
  screen: { id: string; width: number; height: number };
  /** Every prompt the person has said, in order: the model reads them all. */
  prompts: string[];
}

export interface State {
  tree: Tree;
  ctx: Context;
}

// -----------------------------------------------------------------------------
// The tree a model wrote from the dream. Sure of most of it; not of how big
// "much bigger" is (it will ask), nor of where he stands (it picks, and offers
// the other places).
// -----------------------------------------------------------------------------

const L = (zh: string, en: string) => ({ zh, en });

export const MODEL_TREE: Tree = {
  nodes: [
    {
      id: "man",
      label: L("他", "the man"),
      aka: ["他", "男人", "黑衣人", "man", "him", "he"],
      prompt: "一个穿着黑色衣服，很瘦很高的男人，戴着比犹太人的帽子大很多的圆帽子，看着我",
      intents: {
        place: {
          label: L("站在哪", "where he stands"),
          aka: ["站", "放", "回", "去", "到", "stand", "move", "put"],
          kinds: {
            wardrobe: { label: L("衣柜里", "in the wardrobe"), aka: ["衣柜", "柜子", "wardrobe"], realize: { at: [285.5, 640], scale: 1, inside: true } },
            bedside: { label: L("床头", "at the bed"), aka: ["床头", "床", "bed"], realize: { at: [236, 872], scale: 1.9, lean: -3.5 } },
            window: { label: L("窗边", "by the window"), aka: ["窗", "窗边", "window"], realize: { at: [110, 668], scale: 1.12, lean: 1 } },
          },
          p: { bedside: 0.47, wardrobe: 0.43, window: 0.1 },
          resolve: "switch",
        },
        hat: {
          label: L("帽子", "the hat"),
          aka: ["帽子", "帽", "hat"],
          kinds: {
            usual: { label: L("寻常", "usual"), aka: ["正常", "普通", "normal"], realize: { hatScale: 1 } },
            big: { label: L("大很多", "much bigger"), aka: ["大"], realize: { hatScale: 1.45 } },
            absurd: { label: L("大得离谱", "absurd"), aka: ["离谱", "夸张", "huge"], realize: { hatScale: 1.95 } },
          },
          p: { usual: 0.04, big: 0.52, absurd: 0.44 },
          ordered: true,
          resolve: "ask",
        },
        gaze: {
          label: L("看着", "his gaze"),
          aka: ["看", "眼睛", "盯", "look", "eyes", "stare"],
          kinds: {
            me: { label: L("看着我", "at me"), aka: ["看着我", "看我", "盯着"], realize: { eyes: 1 } },
            away: { label: L("没在看", "not looking"), aka: ["别看我", "别看", "移开", "闭眼", "away"], realize: { eyes: 0 } },
          },
          p: { me: 0.93, away: 0.07 },
          resolve: "switch",
        },
      },
    },
    {
      id: "wardrobe",
      label: L("衣柜", "the wardrobe"),
      aka: ["衣柜", "柜子", "柜门", "门", "wardrobe", "door"],
      prompt: "我的衣柜，两扇门；后来他把衣柜门打开",
      intents: {
        door: {
          label: L("柜门", "the door"),
          aka: ["门", "柜门", "door"],
          kinds: {
            closed: { label: L("关着", "closed"), aka: ["关", "关上", "close", "shut"], realize: { open: 0 } },
            ajar: { label: L("一条缝", "ajar"), aka: ["缝", "一条缝", "ajar"], realize: { open: 0.14 } },
            open: { label: L("开着", "open"), aka: ["打开", "开着", "open"], realize: { open: 0.7 } },
          },
          p: { closed: 0.12, ajar: 0.62, open: 0.26 },
          ordered: true,
          resolve: "switch",
        },
      },
    },
  ],
};

export const INITIAL: State = {
  tree: MODEL_TREE,
  ctx: { screen: { id: "phone", width: 390, height: 844 }, prompts: [] },
};

// -----------------------------------------------------------------------------
// Actions and the reducer
// -----------------------------------------------------------------------------

export type Action =
  | { type: "decide"; node: string; intent: string; kind: string; from: NonNullable<Intent["from"]> }
  | { type: "forget"; node: string; intent: string }
  | { type: "replace"; tree: Tree }
  | { type: "frame"; decision: Tree["frame"] }
  | { type: "context"; ctx: Partial<Context> };

const mapIntent = (tree: Tree, node: string, intent: string, f: (i: Intent) => Intent): Tree => ({
  nodes: tree.nodes.map((n) => (n.id !== node ? n : { ...n, intents: { ...n.intents, [intent]: f(n.intents[intent]) } })),
});

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "decide":
      return { ...s, tree: mapIntent(s.tree, a.node, a.intent, (i) => ({ ...i, pick: a.kind, from: a.from })) };
    case "forget":
      return { ...s, tree: mapIntent(s.tree, a.node, a.intent, (i) => ({ ...i, pick: undefined, from: undefined })) };
    case "replace":
      return { ...s, tree: reconcile(s.tree, a.tree) };
    case "frame":
      return { ...s, tree: { ...s.tree, frame: a.decision } };
    case "context":
      return { ...s, ctx: { ...s.ctx, ...a.ctx } };
  }
}

/** A model's new tree, with a person's picks carried over by key wherever they still mean something. */
export function reconcile(prev: Tree, next: Tree): Tree {
  return {
    frame: next.frame ?? prev.frame,
    nodes: next.nodes.map((n) => {
      const old = prev.nodes.find((o) => o.id === n.id);
      if (!old) return n;
      const intents: Record<string, Intent> = {};
      for (const [k, i] of Object.entries(n.intents)) {
        const was = old.intents[k];
        intents[k] = was?.pick && i.kinds[was.pick] && !i.pick ? { ...i, pick: was.pick, from: was.from } : i;
      }
      return { ...n, intents };
    }),
  };
}

// -----------------------------------------------------------------------------
// The tree as text: what would be saved, what a model is shown.
// -----------------------------------------------------------------------------

const pct = (v: number) => Math.round(v * 100);

export function toXml(s: State): string {
  const out = [`<scene of="wardrobe" screen="${s.ctx.screen.width}×${s.ctx.screen.height}"${s.ctx.prompts.length ? ` prompts="${s.ctx.prompts.length}"` : ""}>`];
  const f = s.tree.frame?.pick as { base: string; below: string | null; at: number } | undefined;
  if (f) out.push(`  <frame base="${f.base}"${f.below ? ` below="${f.below}"` : ""} at="${f.at}" from="${s.tree.frame!.from}" />`);
  for (const n of s.tree.nodes) {
    out.push(`  <${n.id}${n.learned ? ' from="model:learned"' : ""} prompt="${n.prompt}">`);
    for (const [k, i] of Object.entries(n.intents)) {
      const kinds = Object.entries(i.kinds).map(([id, kd]) => (kd.learned ? `${id}*` : id)).join(" ");
      const p = Object.entries(i.p)
        .sort((a, b) => b[1] - a[1])
        .map(([id, v]) => `${id} .${String(pct(v)).padStart(2, "0")}`)
        .join(", ");
      out.push(`    <${k} kinds="${kinds}"${i.pick ? ` pick="${i.pick}" from="${i.from}"` : ""} p="${p}" />`);
    }
    out.push(`  </${n.id}>`);
  }
  out.push("</scene>");
  return out.join("\n");
}
