// =============================================================================
// The Wardrobe's intent tree: what the model that made it wrote with the code.
//
// Its reading of the dream, as things and the few intents on each that a
// person might want otherwise: how big "much bigger" is (it is not sure, and
// will ask), where he stands when he comes to the bed (it is not sure, and
// offers the other places), how far the door opens when you wake and how
// slowly. Each kind says what it means in the picture, in the scene's own
// units; a gesture says which drag reaches it. Edits from then on (a person's,
// a model's) are changes to this tree; the code reads it through reintent.
// =============================================================================

import { bindWords, type Answer, type Host, type Tree } from "intents";
import { EMPTY, L, kind, placeName, recordedDrawing, recordedThing, type Need } from "../common/things";

const PROMPT =
  "我梦到一个穿着黑色衣服，很瘦很高的男人站在我的床头看着我。他的头上戴着那种像犹太人一样圆圆的大的帽子，但是比犹太人的帽子大很多。他一开始站在我的衣柜里面，后来把衣柜门打开，走出来站在我的床头看着我。后来我醒了，醒了之后发现我卧室的柜门确实正在打开。";

export const TREE: Tree = {
  scene: "wardrobe",
  title: L("衣柜", "The Wardrobe"),
  prompt: PROMPT,
  // Words → tree: what the model took each stretch of the dream to be about, and what it says.
  spans: bindWords(PROMPT, [
    ["穿着黑色衣服，很瘦很高的男人", "man"],
    ["床头", "man", "stand", "bedside"],
    ["看着我", "man", "gaze", "me"],
    ["圆圆的大的帽子", "man", "hat"],
    ["大很多", "man", "hat", "big"],
    ["衣柜", "wardrobe"],
    ["床头", "man", "stand", "bedside"],
    ["看着我", "man", "gaze", "me"],
    ["柜门", "wardrobe", "door"],
    ["正在打开", "wardrobe", "pace", "slow"],
  ]),
  by: { who: "model:strong", event: "generated the experience" },
  nodes: [
    {
      id: "man",
      draws: "man",
      label: L("他", "the man"),
      aka: ["他", "男人", "黑衣人", "鬼", "man", "him", "he"],
      prompt: "一个穿着黑色衣服，很瘦很高的男人，戴着比犹太人的帽子大很多的圆帽子，看着我",
      intents: {
        hat: {
          label: L("帽子有多大", "how big the hat"),
          aka: ["帽子", "帽", "hat"],
          kinds: {
            usual: { label: L("寻常", "usual"), aka: ["正常", "普通", "差不多大", "normal"], realize: { hatScale: 1 }, words: "差不多大" },
            big: { label: L("大很多", "much bigger"), aka: ["大很多"], realize: { hatScale: 1.45 } },
            absurd: { label: L("大得离谱", "absurd"), aka: ["离谱", "夸张", "huge"], realize: { hatScale: 1.95 } },
          },
          p: { usual: 0.04, big: 0.52, absurd: 0.44 },
          ordered: true,
          resolve: "ask",
          view: ["man.hat"],
        },
        gaze: {
          label: L("看着谁", "his gaze"),
          aka: ["看", "眼睛", "盯", "look", "eyes", "stare"],
          kinds: {
            me: { label: L("看着我", "at me"), aka: ["看着我", "看我", "盯着"], realize: { eyes: 1 } },
            away: { label: L("没在看", "not looking"), aka: ["别看我", "别看", "没有看我", "移开", "闭眼", "away"], realize: { eyes: 0 }, words: "没有看我" },
          },
          p: { me: 0.93, away: 0.07 },
          resolve: "switch",
          view: ["man.eyes"],
        },
        stand: {
          label: L("走到床边时站在哪", "where he stands at the bed"),
          aka: ["站", "站在", "走到", "站到", "stand"],
          kinds: {
            bedside: { label: L("床头", "at the bed's head"), aka: ["床头"], realize: { at: [236, 872], scale: 1.9, lean: -3.5 } },
            foot: { label: L("床尾", "at the foot of the bed"), aka: ["床尾", "脚边"], realize: { at: [318, 858], scale: 1.72, lean: -2 } },
            window: { label: L("窗边", "by the window"), aka: ["窗边", "窗"], realize: { at: [118, 708], scale: 1.32, lean: 1.5 } },
          },
          p: { bedside: 0.46, foot: 0.42, window: 0.12 },
          resolve: "switch",
          gesture: { path: "man[bedside]", field: "at", depth: [600, 0.75, 880, 1.95] },
          view: ["man[bedside]"],
        },
      },
    },
    {
      id: "wardrobe",
      draws: "wardrobe",
      label: L("衣柜", "the wardrobe"),
      aka: ["衣柜", "柜子", "柜门", "门", "wardrobe", "door"],
      prompt: "我的衣柜；醒了之后，柜门确实正在打开",
      intents: {
        door: {
          label: L("醒来时柜门开到多大", "how far the door opens when you wake"),
          aka: ["门", "柜门", "door"],
          kinds: {
            ajar: { label: L("一条缝", "a crack"), aka: ["一条缝", "缝"], realize: { open: 0.18 } },
            half: { label: L("半开", "half open"), aka: ["半开"], realize: { open: 0.36 } },
            wide: { label: L("大开", "wide open"), aka: ["大开", "全开", "打开"], realize: { open: 0.66 } },
          },
          p: { ajar: 0.12, half: 0.58, wide: 0.3 },
          ordered: true,
          resolve: "switch",
          gesture: { path: "wardrobe.door.right", field: "open", axis: { x0: 286, x1: 358, max: 0.8 } },
          view: ["wardrobe.door.right"],
        },
        pace: {
          label: L("开得多慢", "how slowly it opens"),
          aka: ["速度", "pace"],
          kinds: {
            sudden: { label: L("一下子", "all at once"), aka: ["一下子", "猛地"], realize: { over: 2.5 }, words: "猛地打开" },
            slow: { label: L("慢慢地", "slowly"), aka: ["慢慢", "正在打开"], realize: { over: 6.5 }, words: "正在慢慢打开" },
            crawl: { label: L("极慢", "a crawl"), aka: ["极慢", "很慢很慢"], realize: { over: 12 }, words: "极慢地打开" },
          },
          p: { sudden: 0.08, slow: 0.7, crawl: 0.22 },
          ordered: true,
          more: ["慢一点", "更慢", "再慢", "慢些", "slower"],
          less: ["快一点", "更快", "再快", "快些", "faster"],
          resolve: "switch",
          view: ["beat.door"],
        },
      },
    },
  ],
};

// -----------------------------------------------------------------------------
// The host: what the router (and a real model) are told about this scene, and
// the strong model's answers recorded for when none is reachable.
// -----------------------------------------------------------------------------

export const GRAMMAR = `Scene: a child's bedroom at night, 390 × 844 scene units (a phone held upright), y down. The floor line is y 640; the bed's blanket fills y 690–844; the wardrobe stands x 200–372, y 200–642; the window x 40–152, y 172–386.
Library things (draws): man (very tall, thin, in black, a huge round hat; feet at his anchor, 419 units tall at scale 1), wardrobe, window, bed, room.
Realize fields: man.stand { at: [x, y] his feet, scale (1 at the wardrobe's floor y 640, about 1.9 at the bed's head y 872), lean (degrees) } · man.hat { hatScale } · man.gaze { eyes 0–1 } · wardrobe.door { open 0–0.9 } · wardrobe.pace { over: seconds }.
A new thing has intents "place" { at: [x, y] its base, scale } and, if it gives light, "light" { on: true | false }. Its svg is drawn with its base at the origin, about 80 units wide and up to 120 tall at scale 1.`;

/** The strong model's answers, recorded: a lamp, a cat (common/things.ts), "farther away". */
function recorded(need: Need): Answer | null {
  const text = "text" in need ? need.text.toLowerCase() : "";
  const thing = recordedThing(need);
  if (thing) return thing;
  if ((need.kind === "unknown" || need.kind === "new-thing") && /远|退后|后面|深处|far|back/.test(text)) {
    return {
      ...EMPTY,
      note_zh: "「远一点」不是他站过的任何一个位置：加一个更远、更小的",
      note_en: "\"Farther\" is none of the places he stands: a new one, farther and smaller",
      kinds: [{ node: "man", intent: "stand", kind: kind("far", "房间深处", "far back", ["远处", "深处"], { at: [250, 650], scale: 0.95, lean: 0 }, 0.85) }],
      picks: [{ node: "man", intent: "stand", kind: "far" }],
    };
  }
  return null;
}

export const HOST: Host = {
  scene: "wardrobe",
  grammar: GRAMMAR,
  recorded,
  recordedDrawing,
  placeName,
};
