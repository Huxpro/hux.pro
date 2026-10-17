import type { LabTable } from "@/systems/lab";
import type { Source } from "reintent-core";

const en = {
  meta: (cells: number, asks: number, stale: number) => `${cells} cells · ${asks ? `${asks} asked` : "nothing asked"}${stale ? ` · ${stale} stale` : ""}`,
  undo: "Undo",
  reset: "Start over",
  open: "Full screen",
  loading: "Opening the scene…",
  failed: "The scene did not open. Build it first: pnpm experiences:build",

  program: "Program",
  programNote:
    "The program is the parts the model wrote: each declares its intents and returns its drawing. Switch to its rewrite and back: every decision whose path and kind remain is kept; the rest wait, and return with their kind.",
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

  cells: "Cells",
  cellsNote: "Each intent of each thing: its kind now, who said so, and the belief under it. A kind is a decision; ≠ rules the current one out; forget hands it back.",
  ruleOut: "≠",
  ruleOutTitle: "Rule this kind out",
  forget: "Forget",
  stale: "stale",
  learned: "learned",

  log: "What happened",
  logNote: "Each action, and what it changed, cell by cell.",
  nothingYet: "Nothing yet.",

  observe: "What a model is shown",
  source: "Source",
  doc: "Doc",
  docNote: "The only state: what people decided, the model's beliefs (a cache, held under a context), kinds learned, decisions waiting.",

  from: {
    person: "you",
    rule: "your rule",
    author: "author",
    derived: "relation",
    viewer: "viewer",
    model: "model",
    code: "code",
    ask: "asking",
  } satisfies Record<Source, string>,
};

const zh: typeof en = {
  meta: (cells, asks, stale) => `${cells} 个格子 · ${asks ? `${asks} 个在问` : "没有要问的"}${stale ? ` · ${stale} 个过期` : ""}`,
  undo: "撤销",
  reset: "重来",
  open: "全屏",
  loading: "正在打开场景…",
  failed: "场景没有打开。请先构建：pnpm experiences:build",

  program: "程序",
  programNote: "程序就是模型写的 part：每个 part 声明自己的意图，返回自己的画面。切到它的改写版再切回来：路径和 kind 都还在的决定会保留；其余的先等着，kind 回来时它们也回来。",
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

  cells: "格子",
  cellsNote: "每个物体的每个意图：现在是哪个 kind、谁说的、背后的判断。点一个 kind 就是决定它；≠ 排除当前这个；忘掉就交还给模型和代码。",
  ruleOut: "≠",
  ruleOutTitle: "排除这个 kind",
  forget: "忘掉",
  stale: "过期",
  learned: "学到的",

  log: "发生了什么",
  logNote: "每个动作，以及它逐格改变了什么。",
  nothingYet: "还没有。",

  observe: "模型看到的",
  source: "源码",
  doc: "Doc",
  docNote: "唯一的状态：人做的决定、模型的判断（缓存，挂在某个上下文下）、学到的 kind、在等待的决定。",

  from: {
    person: "你",
    rule: "你的规则",
    author: "作者",
    derived: "关系",
    viewer: "观看者",
    model: "模型",
    code: "代码",
    ask: "在问",
  },
};

export const REINTENT_STRINGS: LabTable<typeof en> = { en, zh };
export type ReintentStrings = typeof en;
