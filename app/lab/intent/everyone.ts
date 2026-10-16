import type { Cue } from "stage";
import type { Tree } from "./tree";

// =============================================================================
// /dream/everyone's intent tree, as a strong model authored it (cached, so
// the lab opens without a model; "re-author" writes it again).
//
// A narrative dream: every conversation at once, a touch, a hush spreading
// out from it, and then one light coming to you. Its intents are emotional
// rather than spatial: how the world turns, how loud the crowd is, how the
// quiet spreads, how big the world is, how the one comes to you. Its
// gestures say them with the hands: still the world by pressing it down,
// spin it by pushing it sideways, pull it out to make it larger.
// =============================================================================

export const AUTHORED_BY = "claude (this session, cached)";

export const PRESET: Tree = [
  {
    type: "turning",
    of: "globe",
    words: { en: "The world, turning", zh: "世界在转" },
    kinds: {
      turns: { words: { en: "Turns slowly", zh: "慢慢转" }, patch: { globe: { spin: 0.16 } } },
      still: { words: { en: "Holds still", zh: "停住" }, patch: { globe: { spin: 0 } } },
      spins: { words: { en: "Spins", zh: "转得快" }, patch: { globe: { spin: 0.6 } } },
    },
    prior: { turns: 0.6, still: 0.2, spins: 0.2 },
    resolve: "switch",
    say: {
      turns: ["turn slowly", "let it turn", "慢慢转"],
      still: ["stop", "hold still", "freeze", "停下", "别转了"],
      spins: ["spin", "faster", "转快一点", "转起来"],
    },
    gestures: { spins: [{ from: "globe", dir: "horizontal" }], still: [{ from: "globe", dir: "down" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "crowd",
    of: "voices",
    words: { en: "How many are talking", zh: "有多少人在说话" },
    kinds: {
      crowd: { words: { en: "A crowd", zh: "一大群" }, patch: { voices: { rate: 70 } } },
      few: { words: { en: "A few", zh: "几个人" }, patch: { voices: { rate: 12 } } },
      din: { words: { en: "A din", zh: "人声鼎沸" }, patch: { voices: { rate: 180 } } },
    },
    prior: { crowd: 0.6, few: 0.2, din: 0.2 },
    resolve: "switch",
    say: { crowd: ["a crowd", "一大群人"], few: ["quieter", "fewer", "just a few", "安静一点", "少一点"], din: ["louder", "noisier", "a din", "吵一点", "更热闹"] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "quiet",
    of: "globe",
    words: { en: "How the quiet spreads", zh: "安静怎样散开" },
    kinds: {
      wave: { words: { en: "A wave from your touch", zh: "从你碰的地方像波一样散开" }, patch: { globe: { cross: 1.5 } } },
      sudden: { words: { en: "All at once", zh: "一下子全安静" }, patch: { globe: { cross: 0.5 } } },
      slow: { words: { en: "A slow tide", zh: "慢慢退下去" }, patch: { globe: { cross: 3.5 } } },
    },
    prior: { wave: 0.6, sudden: 0.2, slow: 0.2 },
    resolve: "ask",
    question: {
      en: "When you touch one voice, does the quiet reach everyone at once, or travel out from you?",
      zh: "你碰到一个声音时，安静是一下子到达所有人，还是从你那里一圈圈传出去？",
    },
    say: { wave: ["a wave", "like a wave", "像波浪"], sudden: ["all at once", "suddenly", "一下子", "瞬间"], slow: ["slowly", "a slow tide", "慢慢地"] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "world",
    of: "globe",
    words: { en: "How big the world is", zh: "世界有多大" },
    kinds: {
      asWritten: { words: { en: "As it is", zh: "原样" }, patch: { globe: { size: 0.42 } } },
      larger: { words: { en: "Larger", zh: "更大" }, patch: { globe: { size: 0.5 } } },
      smaller: { words: { en: "Smaller", zh: "更小" }, patch: { globe: { size: 0.28 } } },
    },
    prior: { asWritten: 0.7, larger: 0.15, smaller: 0.15 },
    resolve: "switch",
    say: { larger: ["bigger", "larger", "更大"], smaller: ["smaller", "farther away", "更小", "远一点"] },
    gestures: { larger: [{ from: "self", outOf: "self" }] },
    from: "preset",
    by: AUTHORED_BY,
  },
  {
    type: "nearness",
    of: "light",
    words: { en: "How the one comes to you", zh: "那一点光怎样来到你面前" },
    kinds: {
      slowly: { words: { en: "Slowly", zh: "慢慢地" }, patch: { light: { approach: 1.8 } } },
      atOnce: { words: { en: "At once", zh: "立刻" }, patch: { light: { approach: 0.8 } } },
      shyly: { words: { en: "Shyly", zh: "犹豫地" }, patch: { light: { approach: 3 } } },
    },
    prior: { slowly: 0.6, atOnce: 0.2, shyly: 0.2 },
    resolve: "switch",
    say: { atOnce: ["at once", "come here", "快过来", "立刻"], shyly: ["shyly", "take your time", "慢慢来", "犹豫一点"] },
    from: "preset",
    by: AUTHORED_BY,
  },
];

export const BELIEFS: Record<string, { p: Record<string, number> }> = {
  "turning|globe": { p: { turns: 0.7, still: 0.15, spins: 0.15 } },
  "quiet|globe": { p: { wave: 0.45, sudden: 0.2, slow: 0.35 } },
  "nearness|light": { p: { slowly: 0.55, atOnce: 0.1, shyly: 0.35 } },
};

/** Let them talk a while (the globe is there to drag), touch a voice a little right of the middle; then the hush, and the one coming to you. */
export const SCRIPT: Cue[] = [
  { at: 4.5, down: [0.56, 0.44] },
  { at: 4.6, up: true },
];
export const LOOP = 5;
