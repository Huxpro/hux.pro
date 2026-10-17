// =============================================================================
// The Wardrobe's vocabularies: what each intent can be, the words that say it,
// and what it means in the picture (the scene's units, the same numbers
// experiences/wardrobe/intents.ts realizes). The core knows none of this: it
// is for the words a person says, for a model, and for the view.
// =============================================================================

import { vocab } from "reintent-core/lib/vocab";

export const Size = vocab(
  {
    usual: { label: "寻常 · usual", words: ["寻常", "正常", "普通", "差不多大", "normal"], hatScale: 1 },
    big: { label: "大很多 · much bigger", words: ["大很多"], hatScale: 1.45 },
    absurd: { label: "大得离谱 · absurd", words: ["大得离谱", "离谱", "夸张", "huge"], hatScale: 1.95 },
  },
  { ordered: true },
);

export const Gaze = vocab({
  me: { label: "看着我 · at me", words: ["看着我", "看我", "盯着"], eyes: 1 },
  away: { label: "没在看 · away", words: ["别看我", "没有看我", "移开", "闭眼", "away"], eyes: 0 },
});

export const Place = vocab({
  bedside: { label: "床头 · the bed's head", words: ["床头"], at: [236, 872] as [number, number], scale: 1.9, lean: -3.5 },
  foot: { label: "床尾 · the foot", words: ["床尾", "脚边"], at: [318, 858] as [number, number], scale: 1.72, lean: -2 },
  window: { label: "窗边 · the window", words: ["窗边", "窗"], at: [118, 708] as [number, number], scale: 1.32, lean: 1.5 },
});

export const Open = vocab(
  {
    ajar: { label: "一条缝 · a crack", words: ["一条缝", "缝"], open: 0.18 },
    half: { label: "半开 · half", words: ["半开"], open: 0.36 },
    wide: { label: "大开 · wide", words: ["大开", "全开"], open: 0.66 },
  },
  { ordered: true, more: ["开大一点", "再开", "wider"], less: ["开小一点", "关一点", "narrower"] },
);

export const Pace = vocab(
  {
    sudden: { label: "一下子 · all at once", words: ["一下子", "猛地"], over: 2.5 },
    slow: { label: "慢慢地 · slowly", words: ["慢慢", "正在打开"], over: 6.5 },
    crawl: { label: "极慢 · a crawl", words: ["极慢", "很慢很慢"], over: 12 },
  },
  { ordered: true, more: ["慢一点", "更慢", "再慢", "slower"], less: ["快一点", "更快", "再快", "faster"] },
);

/** The hat as the model rewrote it (v2): "absurd" gives way to "towering". */
export const Hat = vocab(
  {
    usual: { label: "寻常 · usual", words: ["寻常", "正常", "普通"], hatScale: 1 },
    big: { label: "大很多 · much bigger", words: ["大很多"], hatScale: 1.45 },
    towering: { label: "顶天 · towering", words: ["顶天", "高耸", "towering"], hatScale: 2.4 },
  },
  { ordered: true },
);

export const MAN = { label: "他 · the man", aka: ["他", "男人", "黑衣人", "man", "him"] };
export const WARDROBE = { label: "衣柜 · the wardrobe", aka: ["衣柜", "柜子", "柜门", "门", "wardrobe", "door"] };
