import type { Cue } from "stage";
import type { Tree } from "./tree";

// =============================================================================
// /dream/blue's intent tree, as a strong model authored it (cached, so the
// lab opens without a model; "re-author" writes it again).
//
// A composed dream: the sea as grey lines, a ring where the sun is, and the
// real thing opening under a held finger. Its intents are about composition
// and the senses: where the sun sits, where the horizon falls, how large the
// sun is, how the sea opens, whether it is heard. Its gestures move things on
// the picture: drag the sun aside, pull the horizon up or down, lift the sun
// to make it larger.
// =============================================================================

export const AUTHORED_BY = "claude (this session, cached)";

export const PRESET: Tree = [
  {
    type: "sun",
    of: "sun-ring",
    words: { en: "Where the sun is", zh: "太阳在哪里" },
    kinds: {
      right: { words: { en: "To the right", zh: "偏右" }, patch: { "sun-ring": { x: 0.64 } } },
      left: { words: { en: "To the left", zh: "偏左" }, patch: { "sun-ring": { x: 0.32 } } },
      middle: { words: { en: "In the middle", zh: "正中" }, patch: { "sun-ring": { x: 0.5 } } },
    },
    prior: { right: 0.6, left: 0.2, middle: 0.2 },
    resolve: "switch",
    say: { right: ["to the right", "右边", "偏右"], left: ["to the left", "左边", "偏左"], middle: ["in the middle", "centred", "中间", "正中"] },
    gestures: { left: [{ from: "self", dir: "left" }], right: [{ from: "self", dir: "right" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "horizon",
    of: "contours",
    words: { en: "Where the sea meets the sky", zh: "海和天在哪里相接" },
    kinds: {
      asWritten: { words: { en: "Where it is", zh: "原样" }, patch: { contours: { horizon: 0.46 } } },
      high: { words: { en: "High: more sea", zh: "高：海多" }, patch: { contours: { horizon: 0.34 } } },
      low: { words: { en: "Low: more sky", zh: "低：天多" }, patch: { contours: { horizon: 0.58 } } },
    },
    prior: { asWritten: 0.6, high: 0.2, low: 0.2 },
    resolve: "switch",
    say: { high: ["more sea", "raise the horizon", "海多一点", "地平线高一点"], low: ["more sky", "lower the horizon", "天多一点", "地平线低一点"] },
    gestures: { high: [{ from: "self", dir: "up" }], low: [{ from: "self", dir: "down" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "sunSize",
    of: "sun-ring",
    words: { en: "How big the sun is", zh: "太阳有多大" },
    kinds: {
      asWritten: { words: { en: "As it is", zh: "原样" }, patch: { "sun-ring": { size: 0.05 } } },
      larger: { words: { en: "Larger", zh: "更大" }, patch: { "sun-ring": { size: 0.09 } } },
      smaller: { words: { en: "Smaller", zh: "更小" }, patch: { "sun-ring": { size: 0.03 } } },
    },
    prior: { asWritten: 0.7, larger: 0.15, smaller: 0.15 },
    resolve: "switch",
    say: { larger: ["a bigger sun", "larger sun", "太阳大一点"], smaller: ["a smaller sun", "太阳小一点"] },
    // Not "out of itself": the ring is small, and every drag of the sun leaves it.
    gestures: { larger: [{ from: "self", dir: "up" }], smaller: [{ from: "self", dir: "down" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "opening",
    of: "sea",
    words: { en: "How the sea opens", zh: "海怎样打开" },
    kinds: {
      slowly: { words: { en: "Slowly, then all at once", zh: "先慢后快" }, patch: { sea: { open: 2.6 } } },
      quickly: { words: { en: "Quickly", zh: "很快" }, patch: { sea: { open: 1.2 } } },
      reluctantly: { words: { en: "Reluctantly", zh: "很不情愿" }, patch: { sea: { open: 4.5 } } },
    },
    prior: { slowly: 0.6, quickly: 0.2, reluctantly: 0.2 },
    resolve: "switch",
    say: { quickly: ["quickly", "faster", "快一点"], reluctantly: ["slower", "reluctantly", "慢一点"] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "heard",
    of: "surf",
    words: { en: "The sea, heard", zh: "听得见海吗" },
    kinds: {
      heard: { words: { en: "Heard", zh: "听得见" }, patch: { surf: { volume: 0.5 } } },
      silent: { words: { en: "Silent", zh: "无声" }, patch: { surf: { volume: 0 } } },
    },
    prior: { heard: 0.6, silent: 0.4 },
    resolve: "ask",
    question: { en: "When the sea opens, should you hear it?", zh: "海打开的时候，要听得见它吗？" },
    say: { heard: ["with sound", "let me hear it", "有声音"], silent: ["silent", "no sound", "mute", "安静", "静音"] },
    from: "preset",
    by: AUTHORED_BY,
  },
];

export const BELIEFS: Record<string, { p: Record<string, number> }> = {
  "sun|sun-ring": { p: { right: 0.7, left: 0.15, middle: 0.15 } },
  "heard|surf": { p: { heard: 0.55, silent: 0.45 } },
  "horizon|contours": { p: { asWritten: 0.6, high: 0.15, low: 0.25 } },
};

/** Two looks: press below the horizon and hold, let go; again; then thanks. */
export const SCRIPT: Cue[] = [
  { at: 1.6, down: [0.5, 0.78] },
  { at: 4.6, up: true },
  { at: 6.4, down: [0.42, 0.72] },
  { at: 9.4, up: true },
];
export const LOOP = 4;
