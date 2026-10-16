import type { LabTable } from "@/systems/lab";

const en = {
  meta: (events: number, kinds: number) => `${events} events · ${kinds} kinds learned`,
  undo: "Undo",
  reset: "Start over",

  loop: "The loop",
  loopNote:
    "One direction, like React: the intent tree is the state; reintent computes what each intent is now; that is projected to coordinates and drawn. Everything you do here is an event. Its callback reads it against the tree's preset intents: a hit resolves straight into the tree (Flux, no model); a miss goes to the model, which looks at the tree and the event and writes a new tree (ReAct, an effect); a resize only changes the context.",
  flow: {
    model: "model",
    tree: "intent tree",
    compute: "reintent",
    view: "view",
    event: "event",
    recognizer: "recognizer",
    resolve: "① resolve",
    infer: "② infer",
    ask: "ask you",
    context: "context",
  },

  stage: "The scene",
  stageNote: "Drag him: drop him at a place he knows, or anywhere. Drag the right door's edge. Change the screen.",
  screens: { phone: "Phone", square: "Square", wide: "Wide" },
  frames: { fill: "Fill", whole: "Whole" },
  thinking: "The model is looking at the tree and what you did…",
  drawing: "being drawn…",

  say: "Say it",
  sayNote: "A sentence is an event too, said of one thing or of the scene. It joins the context (the model reads every one).",
  of: "of",
  scene: "the scene",
  placeholder: "帽子大一点 · 站到窗边 · 床头放一盏灯…",
  send: "Say",
  tries: ["帽子大一点", "门开大一点", "站到窗边", "大一点", "让他站远一点", "床头放一盏灯", "关灯", "回到衣柜", "别看我"],

  asks: "Asked",
  asksModel: "The model could not tell, and it matters here:",
  asksRecognizer: (text: string) => `"${text}" could mean more than one thing:`,

  tree: "Intent tree",
  treeNote: "The state, as it would be saved and as the model is shown it. Lines that just changed are marked; * marks a kind the model learned from an event.",
  now: "What each intent is now",
  events: "Events",
  eventsNote: "Newest first: the event, how its callback read it, which path it took, what changed.",
  noEvents: "Nothing yet. Drag something, or say something.",
  paths: { resolve: "① resolve · Flux", infer: "② infer · ReAct", ask: "ask", context: "context" },
  sources: { person: "you", model: "model", code: "code", ask: "to ask" },
  observation: "What the model was shown",
  forget: "Forget",
  hit: (what: string) => `hit a preset: ${what}`,
  miss: "no preset reads it",
  edge: "past the end of its scale: no preset goes that far",
  newThing: "it brings in something the tree does not have (an indefinite): no preset can be about it",
  readings: (n: number) => `${n} readings: asked`,
  resized: (s: string) => `screen → ${s}`,
  answered: (what: string) => `answered: ${what}`,
};

const zh: typeof en = {
  meta: (events, kinds) => `${events} 个事件 · 学到 ${kinds} 种新的`,
  undo: "撤销",
  reset: "重来",

  loop: "回路",
  loopNote:
    "单向数据流，像 React：意图树是唯一的状态；reintent 算出每个意图此刻是什么；再投影成坐标、画出来。你在这里做的每件事都是一个事件，它的回调拿它去比对树上的预设意图：命中就直接 resolve 进树（Flux，不调用模型）；识别不了就交给模型，模型看着现在的树和这个事件写出一棵新的树（ReAct，一个 effect）；改尺寸只改上下文。",
  flow: {
    model: "模型",
    tree: "意图树",
    compute: "reintent",
    view: "视图",
    event: "事件",
    recognizer: "识别器",
    resolve: "① resolve",
    infer: "② infer",
    ask: "问你",
    context: "上下文",
  },

  stage: "场景",
  stageNote: "拖他：放到他认识的位置，或者随便哪里。拖右边柜门的边。换一块屏幕。",
  screens: { phone: "手机", square: "方屏", wide: "宽屏" },
  frames: { fill: "铺满", whole: "原样" },
  thinking: "模型在看现在的树和你刚做的事…",
  drawing: "正在画…",

  say: "说一句",
  sayNote: "一句话也是一个事件，对某样东西说，或对整个场景说。它会进入上下文（模型每次都会读到所有说过的话）。",
  of: "对",
  scene: "场景",
  placeholder: "帽子大一点 · 站到窗边 · 床头放一盏灯…",
  send: "说",
  tries: ["帽子大一点", "门开大一点", "站到窗边", "大一点", "让他站远一点", "床头放一盏灯", "关灯", "回到衣柜", "别看我"],

  asks: "要问你的",
  asksModel: "模型拿不准，而这会改变画面：",
  asksRecognizer: (text) => `「${text}」可以有不止一种意思：`,

  tree: "意图树",
  treeNote: "状态本身：存下来的样子，也是给模型看的样子。刚变的行有标记；* 是模型从某个事件里学到的新种类。",
  now: "每个意图此刻是什么",
  events: "事件",
  eventsNote: "最新的在上：事件、回调怎么读它、走了哪条路、改了什么。",
  noEvents: "还没有。拖点什么，或者说点什么。",
  paths: { resolve: "① resolve · Flux", infer: "② infer · ReAct", ask: "提问", context: "上下文" },
  sources: { person: "你", model: "模型", code: "代码", ask: "待问" },
  observation: "给模型看的",
  forget: "忘掉",
  hit: (what) => `命中预设：${what}`,
  miss: "没有预设能读它",
  edge: "超出了这个尺度的尽头：没有预设能到那么远",
  newThing: "它引入了树里没有的东西（不定指：一盏…）：没有哪个预设能是关于它的",
  readings: (n) => `${n} 种读法：问你`,
  resized: (s) => `屏幕 → ${s}`,
  answered: (what) => `你答：${what}`,
};

export type IntentsStrings = typeof en;
export const INTENTS_STRINGS: LabTable<typeof en> = { en, zh };
