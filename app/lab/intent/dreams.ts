import Blue from "@/app/dream/blue/blue.scene";
import Everyone from "@/app/dream/everyone/everyone.scene";
import Forget from "@/app/dream/forget/forget.scene";
import { MOMENT_NAMES } from "@/app/dream/forget/kinds/pictures";
import type { ComponentType } from "react";
import type { Cue } from "stage";
import * as blue from "./blue";
import * as everyone from "./everyone";
import * as forget from "./forget";
import type { Settle } from "./model";
import type { Tree, Words } from "./tree";

// =============================================================================
// The dreams the Intent Lab works on. Everything the lab does (drop zones,
// directions, previews, the event paths) is read off a dream's intent tree;
// this is only what the page needs to show each one: its scene, its ground,
// the performance it gives on every screen, and words for its things.
// =============================================================================

export type DreamId = "forget" | "everyone" | "blue";

export interface Dream {
  id: DreamId;
  path: string;
  Scene: ComponentType;
  /** The stage's ground, and the ink its words and zones are drawn in ("r, g, b"). */
  background: string;
  ink: string;
  preset: Tree;
  beliefs: Record<string, { p: Record<string, number> }>;
  authoredBy: string;
  settle?: Settle;
  script: Cue[];
  loop: number;
  /** Its things, as a person names them. */
  things: Record<string, Words>;
  /** A population's members, by index. */
  members?: Record<string, { en: string[]; zh: string[] }>;
  /** Which thing a press is on when several are under it, first first. */
  hitOrder: string[];
  /** Things a press on counts as on another (a part of it). */
  partOf?: Record<string, string>;
  /** The screen it opens on. */
  focus: string;
  /** What is under a press on nothing. */
  ground: Words;
  /** The performance every screen gives ("the same …"). */
  performs: Words;
  /** Its gestures, in a sentence. */
  gestures: Words;
  /** What one might say to it. */
  placeholder: Words;
  /**
   * Intents about a moment rather than a layout (how the hush spreads, how
   * the sea opens): nothing at rest shows them, so a preview of one performs
   * that moment again, soon, with `script`.
   */
  replay?: { keys: string[]; script: Cue[] };
}

export const DREAMS: Record<DreamId, Dream> = {
  forget: {
    id: "forget",
    path: "/dream/forget",
    Scene: Forget,
    background: "#f2ede3",
    ink: "40, 36, 32",
    preset: forget.PRESET,
    beliefs: forget.BELIEFS,
    authoredBy: forget.AUTHORED_BY,
    settle: forget.settle,
    script: forget.SCRIPT,
    loop: forget.LOOP,
    things: {
      window: { en: "the window", zh: "窗" },
      edge: { en: "the edge", zh: "窗沿" },
      tide: { en: "the tide", zh: "退潮" },
      dust: { en: "the dust", zh: "尘" },
      moments: { en: "the moments", zh: "画面" },
    },
    members: { moments: { en: MOMENT_NAMES, zh: ["你的猫", "一个深夜", "我们俩", "一个家", "一个小太阳"] } },
    hitOrder: ["moments", "window", "edge", "tide", "dust"],
    partOf: { edge: "window", tide: "window" },
    focus: "landscape",
    ground: { en: "the paper", zh: "纸面" },
    performs: { en: "performing the same hold and let-go", zh: "「按住、松开」" },
    gestures: {
      en: "A moment out of the window keeps it, back in lets it go; the window sideways lays it down, up stands it up; the dust down settles it.",
      zh: "把画面拖出窗外就留住它，拖回窗里就让它走；把窗横着拖让它躺下，竖着拖让它立起；把尘往下拉让它落下。",
    },
    placeholder: { en: "Say what you mean: slower, like snow, sadder, 落下…", zh: "说你的意思：慢一些、像雪、更伤感、落下……" },
  },
  everyone: {
    id: "everyone",
    path: "/dream/everyone",
    Scene: Everyone,
    background: "#06060a",
    ink: "236, 236, 244",
    preset: everyone.PRESET,
    beliefs: everyone.BELIEFS,
    authoredBy: everyone.AUTHORED_BY,
    script: everyone.SCRIPT,
    loop: everyone.LOOP,
    things: {
      globe: { en: "the world", zh: "世界" },
      voices: { en: "the voices", zh: "人声" },
      light: { en: "the one", zh: "那一点光" },
    },
    hitOrder: ["light", "globe", "voices"],
    focus: "laptop",
    ground: { en: "the dark", zh: "黑暗" },
    performs: { en: "performing the same touch, hush, and one light coming", zh: "「一碰、安静下来、一点光走近」" },
    gestures: {
      en: "The world pushed sideways spins, pressed down holds still; pulled out of itself it grows.",
      zh: "把世界横着推它就转快，往下按它就停住；从它里面往外拉，它就变大。",
    },
    placeholder: { en: "Say what you mean: quieter, a slower hush, come here, 安静一点…", zh: "说你的意思：安静一点、慢慢安静、快过来、louder…" },
    replay: {
      keys: ["quiet|globe", "nearness|light"],
      script: [
        { at: 0.6, down: [0.56, 0.44] },
        { at: 0.7, up: true },
      ],
    },
  },
  blue: {
    id: "blue",
    path: "/dream/blue",
    Scene: Blue,
    background: "#0b0c0e",
    ink: "226, 232, 240",
    preset: blue.PRESET,
    beliefs: blue.BELIEFS,
    authoredBy: blue.AUTHORED_BY,
    script: blue.SCRIPT,
    loop: blue.LOOP,
    things: {
      "sun-ring": { en: "the sun", zh: "太阳" },
      contours: { en: "the sea", zh: "海" },
      sea: { en: "the open sea", zh: "打开的海" },
      sun: { en: "the real sun", zh: "真的太阳" },
      surf: { en: "the surf", zh: "海浪声" },
    },
    hitOrder: ["sun-ring", "sun", "contours"],
    partOf: { sun: "sun-ring" },
    focus: "phone",
    ground: { en: "the sky", zh: "天空" },
    performs: { en: "performing the same two held looks", zh: "「按住看两次」" },
    gestures: {
      en: "The sun dragged aside moves it; the sea dragged up or down moves the horizon; the sun lifted grows, lowered shrinks.",
      zh: "把太阳往两边拖它就挪过去；把海往上或往下拖，地平线就跟着走；把太阳往上提它就变大，往下按就变小。",
    },
    placeholder: { en: "Say what you mean: more sky, a bigger sun, silent, 海多一点…", zh: "说你的意思：天多一点、太阳大一点、静音、more sea…" },
    replay: {
      keys: ["opening|sea", "heard|surf"],
      script: [
        { at: 0.4, down: [0.5, 0.78] },
        { at: 3.4, up: true },
        { at: 4, down: [0.42, 0.72] },
        { at: 7, up: true },
      ],
    },
  },
};

export const DREAM_IDS: DreamId[] = ["forget", "everyone", "blue"];
