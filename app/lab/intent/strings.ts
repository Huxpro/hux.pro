import type { LabTable } from "@/systems/lab";
import type { IntentType } from "./forget";
import type { Who } from "./model";

const en = {
  meta: (screens: number, asks: number, decided: number) =>
    `/dream/forget · ${screens} screens · ${asks ? `${asks} question` : "nothing to ask"} · ${decided} decided`,
  undo: "Undo",
  reset: "Reset",
  // The stage
  focus: "On this screen",
  focusNote:
    "The real /dream/forget, at this screen's size, performing the same hold and let-go on every screen. What it shows is its own scene with the four intents compiled over it.",
  shape: "Which way the moments go, by the screen's shape",
  shapeNote:
    "Wide on the left, tall on the right. Up a tall window, or across one lying on its side. A switch on one screen moves where it crosses over: every screen past it follows; the rest keep theirs.",
  crossCode: "code decides where: upright while a row keeps 64 px",
  crossAt: (at: string) => `you moved it to ${at}`,
  wall: "Every screen",
  wallNote: "Each is the dream at that size, live. Tap one to look at it, and to decide there.",
  screens: {
    phone: "Phone",
    tablet: "Tablet",
    square: "Square",
    laptop: "Laptop",
    landscape: "Phone, on its side",
    wide: "Ultrawide",
  } as Record<string, string>,
  /** On the ruler, where neighbours are close. */
  short: { landscape: "Sideways" } as Record<string, string>,
  // The panel
  asking: "A question",
  question: "When you hold on, does the moment at the edge still wear away?",
  questionNote: "The model is not sure (52 : 48), and this one is what the dream means, so it asks rather than guess. One answer holds on every screen.",
  intents: (screen: string) => `Intents · ${screen}`,
  intentsNote:
    "Each is a closed choice. A person's decision outranks their preference, which outranks a model sure enough (best beats second by 0.2), which outranks code.",
  types: {
    axis: "Which way they go",
    holding: "Holding on",
    letgo: "Letting go",
    dust: "What is left",
  } satisfies Record<IntentType, string>,
  kinds: {
    up: "Up",
    across: "Across",
    wears: "Wears away",
    keeps: "Waits",
    tide: "A tide",
    oneByOne: "One by one",
    rises: "Rises",
    settles: "Settles",
  } as Record<string, string>,
  who: {
    person: "you",
    pref: "your preference",
    model: "the model",
    code: "code",
  } satisfies Record<Who, string>,
  whoWhere: "the model says what · code says where",
  forget: "forget",
  stored: "Stored",
  storedNote: "Only what a person decided is kept, beside the scene. The model's beliefs are a cache; what each screen gets is computed.",
  nothingStored: "Nothing yet: every screen is the model's and code's.",
  props: "This screen's props",
  propsNote: "What the four intents compile to, set over the scene's own on this screen only. The scene file does not change.",
};

const zh: typeof en = {
  meta: (screens, asks, decided) =>
    `/dream/forget · ${screens} 块屏幕 · ${asks ? `${asks} 个问题` : "无需提问"} · ${decided} 个决定`,
  undo: "撤销",
  reset: "重置",
  focus: "这块屏幕",
  focusNote:
    "真正的 /dream/forget，按这块屏幕的尺寸运行，每块屏幕上演同一段「按住、松开」。它显示的是它自己的场景，四个意图编译后叠在上面。",
  shape: "画面往哪里走，按屏幕的形状",
  shapeNote:
    "左边宽，右边高。竖着的窗往上走，或者窗躺倒、横着走。在一块屏幕上切换，会把交叉点挪到它的形状：越过它的屏幕都跟着变，其余的保持不变。",
  crossCode: "代码决定在哪里交叉：一行还有 64 px 就竖着",
  crossAt: (at) => `你把它挪到了 ${at}`,
  wall: "每一块屏幕",
  wallNote: "每一块都是这个梦在那个尺寸下的实时运行。点一块来看它，并在那里做决定。",
  screens: {
    phone: "手机",
    tablet: "平板",
    square: "方屏",
    laptop: "笔记本",
    landscape: "横放的手机",
    wide: "带鱼屏",
  },
  short: { landscape: "横放" },
  asking: "一个问题",
  question: "按住的时候，窗沿上那个画面还会继续磨损吗？",
  questionNote: "模型没有把握（52 : 48），而这正是这个梦的含义，所以问，而不是猜。答一次，所有屏幕都按这个来。",
  intents: (screen) => `意图 · ${screen}`,
  intentsNote: "每一个都是闭集里的选择。人的决定 > 人的偏好 > 足够确定的模型（最高比第二高多 0.2）> 代码。",
  types: {
    axis: "往哪里走",
    holding: "按住时",
    letgo: "松开时",
    dust: "留下的",
  },
  kinds: {
    up: "向上",
    across: "横向",
    wears: "仍会磨损",
    keeps: "停住等你",
    tide: "像退潮",
    oneByOne: "一个一个",
    rises: "升起",
    settles: "落下",
  },
  who: {
    person: "你",
    pref: "你的偏好",
    model: "模型",
    code: "代码",
  },
  whoWhere: "模型决定变成什么 · 代码决定在哪里变",
  forget: "忘掉",
  stored: "存下的",
  storedNote: "只存人做的决定，放在场景旁边。模型的判断是缓存；每块屏幕得到什么是算出来的。",
  nothingStored: "还没有：每块屏幕都由模型和代码决定。",
  props: "这块屏幕的 props",
  propsNote: "四个意图编译出的值，只在这块屏幕上叠在场景自己的值上面。场景文件不变。",
};

export const INTENT_STRINGS: LabTable<typeof en> = { en, zh };
export type IntentStrings = typeof en;
