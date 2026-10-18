import type { LabTable } from "@/systems/lab";
import type { By } from "reintent-core";

const en = {
  meta: (cells: number, asks: number, stale: number) => `${cells} intents · ${asks ? `${asks} asked` : "nothing asked"}${stale ? ` · ${stale} stale` : ""}`,
  undo: "Undo",
  reset: "Start over",
  open: "Full screen",
  loading: "Opening the scene…",
  failed: "The scene did not open. Build it first: pnpm experiences:build",

  program: "Program",
  programNote:
    "The program is what the model wrote: an intent tree (elements and literal props) on intent components that read their intents as values and say what was decided, with no view. Switch to its rewrite and back: every decision whose intent and kind remain still applies; the rest wait in the source, and apply again when their kind is back.",
  added: "new",
  removed: "gone",
  kept: "kept",
  suspended: "waiting",
  restored: "back",

  say: "Say",
  sayNote: "A sentence is read against the program's own words: it resolves, asks, goes to a model, or is said of the whole.",
  sayPlaceholder: "帽子大一点 · 门慢一点 · 更压抑一点",
  send: "Say",
  outcomes: { resolve: "resolved", ask: "asked", infer: "to a model", context: "context" } as Record<string, string>,

  asked: "Asked",
  askedNote: "The model is not sure, and the intent asks rather than guessing.",
  answer: "Answer",

  worlds: "Worlds",
  worldsNote:
    "The likeliest choice maps, each with its joint probability: a world is chosen whole, then rendered. The render above settles each intent on its own, which can pick a combination the model holds unlikely.",
  worldNow: "rendered",
  chooseWorld: "Choose",
  given: "given",

  cells: "Intents",
  cellsNote: "Each intent the render read: its value now, who said so, and the belief under it. A kind is a decision; ≠ rules the current one out; forget hands it back.",
  ruleOut: "≠",
  ruleOutTitle: "Rule this kind out",
  forget: "Forget",
  stale: "stale",
  waiting: (kind: string) => `${kind} waiting`,
  learned: "learned",

  log: "What happened",
  logNote: "Each action, and what it changed, cell by cell.",
  nothingYet: "Nothing yet.",

  observe: "What a model is shown",
  source: "Source",
  doc: "Doc",
  docNote: "The only state: the source, by path. What people decided, the model's beliefs, kinds a model learned. The render is computed from it.",

  from: {
    human: "you",
    deck: "your rule",
    model: "model",
    code: "code",
    unresolved: "code's pick",
    unknown: "not here",
    ask: "asking",
  } satisfies Record<By | "deck" | "ask", string>,
};

const zh: typeof en = {
  meta: (cells, asks, stale) => `${cells} 个意图 · ${asks ? `${asks} 个在问` : "没有要问的"}${stale ? ` · ${stale} 个过期` : ""}`,
  undo: "撤销",
  reset: "重来",
  open: "全屏",
  loading: "正在打开场景…",
  failed: "场景没有打开。请先构建：pnpm experiences:build",

  program: "程序",
  programNote: "程序是模型写的：一棵意图树（只有元素和字面量 props），跑在意图组件上；意图组件把意图当作值来读，说出决定了什么，不含视图。切到它的改写版再切回来：意图和 kind 都还在的决定照样生效；其余的留在 source 里等着，kind 回来时再生效。",
  added: "新增",
  removed: "移除",
  kept: "保留",
  suspended: "等待",
  restored: "回来",

  say: "说",
  sayNote: "一句话会对着程序自己的说法来读：直接决定、提问、交给模型，或者当作对整体说的话。",
  sayPlaceholder: "帽子大一点 · 门慢一点 · 更压抑一点",
  send: "说",
  outcomes: { resolve: "直接决定", ask: "提问", infer: "交给模型", context: "上下文" },

  asked: "在问",
  askedNote: "模型拿不准，这个意图选择问你而不是猜。",
  answer: "回答",

  worlds: "世界",
  worldsNote: "最可能的几组选择，每组带着它的联合概率：先整组选定一个世界，再渲染。上面的渲染是每个意图各自定，可能拼出模型认为不太可能的组合。",
  worldNow: "当前渲染",
  chooseWorld: "选这个",
  given: "条件",

  cells: "意图",
  cellsNote: "这次渲染读到的每个意图：现在的值、谁说的、背后的判断。点一个 kind 就是决定它；≠ 排除当前这个；忘掉就交还给模型和代码。",
  ruleOut: "≠",
  ruleOutTitle: "排除这个 kind",
  forget: "忘掉",
  stale: "过期",
  waiting: (kind) => `${kind} 在等`,
  learned: "学到的",

  log: "发生了什么",
  logNote: "每个动作，以及它逐格改变了什么。",
  nothingYet: "还没有。",

  observe: "模型看到的",
  source: "源码",
  doc: "Doc",
  docNote: "唯一的状态：source，按路径存。人做的决定、模型的判断、模型学到的 kind。渲染结果由它算出来。",

  from: {
    human: "你",
    deck: "你的规则",
    model: "模型",
    code: "代码",
    unresolved: "代码先选",
    unknown: "不在这里",
    ask: "在问",
  },
};

export const REINTENT_STRINGS: LabTable<typeof en> = { en, zh };
export type ReintentStrings = typeof en;
