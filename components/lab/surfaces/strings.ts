import type { LabTable } from "@/app/lab/i18n";

const en = {
  // Works
  logSummary: (commits: number, tags: number) => `log.json · ${commits} commits · ${tags} tags`,
  // Attachments
  kinds: { recording: "recording", deck: "deck", page: "page" },
  // Legibility
  rungs: { ink: "ink", muted: "muted", tertiary: "3rd", quaternary: "4th" },
  flip: "flip",
  flipMid: "flip·mid",
  noFlip: "ink",
  busy: "busy",
  relief: "relief",
  // Glow
  hey: "Hey.",
  listening: "listening…",
  // Vitre
  vitreTagline: "Safari's glass, in your colours",
};

const zh: typeof en = {
  logSummary: (commits, tags) => `log.json · ${commits} 条提交 · ${tags} 个标签`,
  kinds: { recording: "录像", deck: "幻灯片", page: "网页" },
  rungs: { ink: "主墨", muted: "次墨", tertiary: "三阶", quaternary: "四阶" },
  flip: "反色",
  flipMid: "中段反色",
  noFlip: "原墨",
  busy: "繁忙",
  relief: "浮雕",
  hey: "嘿。",
  listening: "聆听中…",
  vitreTagline: "让 Safari 的玻璃，显示你的颜色",
};

/** The surfaces' words — each lab at a glance, in the reader's language. */
export const SURFACE_STRINGS: LabTable<typeof en> = { en, zh };
