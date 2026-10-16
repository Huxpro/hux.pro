// =============================================================================
// A dream told as a tree: the cast, and one node per beat.
//
// The player (Dream.tsx) has no dream of its own. It plays whatever tree it is
// given over the shared bedroom and him: each beat a node whose intents say
// where he is, how far the wardrobe door is open, whether he looks at you and
// how long the beat lasts. A new dream is a new tree, written by the strong
// model from the words (or, with no model reachable, composed from them by
// the stand-in below); the code does not change.
//
// TREE is the first dream, as the model wrote it. Where it was unsure (where
// he is in the second beat) it says so, and the player asks.
// =============================================================================

import { applyAnswer, type Answer, type AnswerKind, type AnswerNode, type Host, type Intent, type Tree } from "intents";
import { EMPTY, L, kind, placeName, recordedDrawing, recordedThing, type Need } from "../common/things";

// -----------------------------------------------------------------------------
// The grammar of a beat: the kinds the library offers, in the scene's units.
// -----------------------------------------------------------------------------

interface Option {
  zh: string;
  en: string;
  aka: string[];
  realize: Record<string, unknown>;
  /** How the words say it, written back when it is chosen (default: zh); its aka is found inside it. */
  words?: string;
}

/** Where he can be: library places (and "not there"). */
export const PLACES: Record<string, Option> = {
  inside: { zh: "衣柜里", en: "in the wardrobe", aka: ["衣柜里", "柜子里", "衣柜", "柜子", "里面"], realize: { at: [285.5, 640], scale: 1, inside: true } },
  window: { zh: "窗边", en: "by the window", aka: ["窗边", "窗前", "窗"], realize: { at: [118, 708], scale: 1.32, lean: 1.5 } },
  room: { zh: "屋子中间", en: "in the middle of the room", aka: ["屋子中间", "房间中间", "中间", "屋里"], realize: { at: [200, 712], scale: 1.4, lean: 0 } },
  foot: { zh: "床尾", en: "at the foot of the bed", aka: ["床尾", "脚边", "床脚"], realize: { at: [318, 858], scale: 1.72, lean: -2 } },
  bedside: { zh: "床头", en: "at the bed's head", aka: ["床头", "床边", "枕边", "旁边"], realize: { at: [236, 872], scale: 1.9, lean: -3.5 } },
  gone: { zh: "不在", en: "not there", aka: ["不见", "消失", "不在", "没有人", "走了"], realize: { absent: true }, words: "不见了" },
};

export const DOORS: Record<string, Option> = {
  shut: { zh: "关着", en: "shut", aka: ["关着", "关上", "关"], realize: { open: 0 } },
  ajar: { zh: "一条缝", en: "a crack", aka: ["一条缝", "缝"], realize: { open: 0.18 }, words: "开着一条缝" },
  half: { zh: "半开", en: "half open", aka: ["半开"], realize: { open: 0.36 }, words: "半开着" },
  wide: { zh: "大开", en: "wide open", aka: ["大开", "全开", "敞开", "开着"], realize: { open: 0.66 }, words: "大开着" },
};

export const GAZES: Record<string, Option> = {
  me: { zh: "看着我", en: "at me", aka: ["看着我", "看我", "盯着"], realize: { eyes: 1 } },
  away: { zh: "没在看", en: "not looking", aka: ["别看我", "不看我", "背对", "不看", "别看", "转过去", "低着头"], realize: { eyes: 0 }, words: "背对着我" },
};

export const HOLDS: Record<string, Option> = {
  brief: { zh: "一瞬", en: "brief", aka: ["一瞬", "很快"], realize: { over: 3.5 } },
  long: { zh: "很久", en: "long", aka: ["很久", "好久"], realize: { over: 6.5 } },
};

const ORDINALS = [
  { zh: "第一幕", en: "first", aka: ["第一幕", "一开始", "开始", "最初", "first"] },
  { zh: "第二幕", en: "second", aka: ["第二幕", "然后", "second"] },
  { zh: "第三幕", en: "third", aka: ["第三幕", "后来", "third"] },
  { zh: "第四幕", en: "fourth", aka: ["第四幕", "接着", "fourth"] },
  { zh: "第五幕", en: "fifth", aka: ["第五幕", "最后", "fifth"] },
];

/** What each beat's intents are called, and which options they draw on. */
const INTENTS = {
  where: { zh: "他在哪", en: "where he is", aka: ["在", "站", "站在", "站到", "走到", "where"], options: PLACES, ordered: false },
  door: { zh: "柜门开到多大", en: "how far the door is open", aka: ["门", "柜门", "door"], options: DOORS, ordered: true },
  gaze: { zh: "看着谁", en: "his gaze", aka: ["看", "眼睛", "盯", "look", "eyes"], options: GAZES, ordered: false },
  hold: { zh: "这一幕多长", en: "how long it lasts", aka: ["这一幕", "多长", "多久"], options: HOLDS, ordered: true },
} as const;

type IntentName = keyof typeof INTENTS;

// -----------------------------------------------------------------------------
// The player's conventions, laid over any tree a model writes (Host.shape):
// a beat's "where" is dragged by dragging him, and "longer" is its "hold".
// -----------------------------------------------------------------------------

export function shape(tree: Tree): Tree {
  const beats = new Set((tree.phases ?? []).map((p) => p.node));
  return {
    ...tree,
    nodes: tree.nodes.map((n) => {
      if (n.draws === "man" && n.intents.hat) return { ...n, intents: { ...n.intents, hat: { ...n.intents.hat, view: ["man.hat"] } } };
      if (!beats.has(n.id)) return n;
      const intents: Record<string, Intent> = { ...n.intents };
      // How each library kind is said, so a pick can be written back into the words.
      for (const [name, spec] of Object.entries(INTENTS)) {
        const i = intents[name];
        if (!i) continue;
        const options = spec.options as Record<string, Option>;
        intents[name] = { ...i, kinds: Object.fromEntries(Object.entries(i.kinds).map(([k, kd]) => [k, options[k] ? { ...kd, words: options[k].words ?? options[k].zh } : kd])) };
      }
      // Tree → view: what each of a beat's intents moves in the picture (while it is the beat on screen).
      if (intents.where) intents.where = { ...intents.where, gesture: { path: "man", field: "at", depth: [600, 0.75, 880, 1.95] }, view: ["man"] };
      if (intents.door) intents.door = { ...intents.door, view: ["wardrobe.door.right", "wardrobe.door.left"] };
      if (intents.gaze) intents.gaze = { ...intents.gaze, view: ["man.eyes"] };
      if (intents.hold) intents.hold = { ...intents.hold, more: ["久一点", "长一点", "慢一点", "longer"], less: ["短一点", "快一点", "shorter"], view: ["phase.dream"] };
      return { ...n, intents };
    }),
  };
}

// -----------------------------------------------------------------------------
// Beats, in the answer's shape (what a model writes, and the stand-in too).
// -----------------------------------------------------------------------------

/** Beliefs over all of an intent's options: those given, and what is left spread over the rest by weight. */
function beliefs(weights: Record<string, number>, given: Record<string, number>): Record<string, number> {
  const left = Math.max(0, 1 - Object.values(given).reduce((a, b) => a + b, 0));
  const rest = Object.keys(weights).filter((k) => !(k in given));
  const sum = rest.reduce((a, k) => a + weights[k], 0) || 1;
  return Object.fromEntries(Object.keys(weights).map((k) => [k, given[k] ?? (weights[k] / sum) * left]));
}

/** One intent of a beat, every option a kind, with beliefs. */
function intent(name: IntentName, given: Record<string, number>, resolve: "ask" | "switch" = "switch") {
  const spec = INTENTS[name];
  const options = spec.options as Record<string, Option>;
  const p = beliefs(Object.fromEntries(Object.keys(options).map((k) => [k, 1])), given);
  const kinds: AnswerKind[] = Object.entries(options).map(([id, o]) => kind(id, o.zh, o.en, o.aka, o.realize, p[id]));
  return { name, label_zh: spec.zh, label_en: spec.en, aka: [...spec.aka], resolve, ordered: spec.ordered, kinds };
}

interface BeatSpec {
  line: string;
  where: Record<string, number>;
  door: Record<string, number>;
  gaze: Record<string, number>;
  hold: Record<string, number>;
}

function beatNode(i: number, b: BeatSpec): AnswerNode {
  const top = Object.entries(b.where).sort((x, y) => y[1] - x[1])[0][0];
  const o = ORDINALS[i] ?? { zh: `第${i + 1}幕`, en: `beat ${i + 1}`, aka: [] };
  return {
    id: `b${i + 1}`,
    label_zh: `${o.zh} · ${PLACES[top].zh}`,
    label_en: `${o.en} · ${PLACES[top].en}`,
    aka: o.aka,
    prompt: b.line,
    draws: null,
    svg: null,
    // Where he is asks when the model is unsure (reintent's resolve is per intent: every beat's "where" asks).
    intents: [intent("where", b.where, "ask"), intent("door", b.door), intent("gaze", b.gaze), intent("hold", b.hold)],
  };
}

/** Him: the cast. The hat as the words say, or much bigger, most likely. */
function castNode(hat: Record<string, number>): AnswerNode {
  const p = beliefs({ usual: 0.1, big: 0.6, absurd: 0.3 }, hat);
  return {
    id: "man",
    label_zh: "他",
    label_en: "the man",
    aka: ["他", "男人", "黑衣人", "man", "him", "he"],
    prompt: "一个穿着黑色衣服，很瘦很高的男人，戴着大得出奇的圆帽子",
    draws: "man",
    svg: null,
    intents: [
      {
        name: "hat",
        label_zh: "帽子有多大",
        label_en: "how big the hat",
        aka: ["帽子", "帽", "hat"],
        resolve: "switch",
        ordered: true,
        kinds: [
          kind("usual", "寻常", "usual", ["正常", "普通"], { hatScale: 1 }, p.usual),
          kind("big", "大很多", "much bigger", ["大很多"], { hatScale: 1.45 }, p.big),
          kind("absurd", "大得离谱", "absurd", ["离谱", "夸张", "巨大"], { hatScale: 1.95 }, p.absurd),
        ],
      },
    ],
  };
}

// -----------------------------------------------------------------------------
// The first dream.
// -----------------------------------------------------------------------------

const FIRST_PROMPT = "我又梦到他了。一开始，衣柜门开着一条缝，他在里面看着我。然后他换了个地方，背对着我。最后他站在我床头，弯下腰，帽子大得遮住了半个房间。";

const FIRST: Answer = {
  ...EMPTY,
  note_zh: "三幕：门缝里、换了个地方、床头；第二幕没说他换到了哪（窗边还是床尾），我拿不准，问你",
  note_en: "Three beats: in the gap, somewhere else, at the bed; the second does not say where (the window or the foot of the bed?), so I ask",
  title_zh: "又一个梦",
  title_en: "Another Dream",
  nodes: [
    castNode({ absurd: 0.6, big: 0.36 }),
    beatNode(0, { line: "衣柜门开着一条缝，他在里面看着我", where: { inside: 0.9 }, door: { ajar: 0.8 }, gaze: { me: 0.9 }, hold: { long: 0.7 } }),
    beatNode(1, { line: "然后他换了个地方，背对着我", where: { window: 0.48, foot: 0.4 }, door: { half: 0.6 }, gaze: { away: 0.85 }, hold: { brief: 0.6 } }),
    beatNode(2, { line: "最后他站在我床头，弯下腰", where: { bedside: 0.92 }, door: { wide: 0.7 }, gaze: { me: 0.95 }, hold: { long: 0.8 } }),
  ],
  phases: ["b1", "b2", "b3"],
  // Words → tree. "换了个地方" names where he is in the second beat and says no place: that is what the model asks.
  spans: [
    { text: "他", node: "man", intent: "", kind: "" },
    { text: "一开始", node: "b1", intent: "", kind: "" },
    { text: "开着一条缝", node: "b1", intent: "door", kind: "ajar" },
    { text: "里面", node: "b1", intent: "where", kind: "inside" },
    { text: "看着我", node: "b1", intent: "gaze", kind: "me" },
    { text: "然后", node: "b2", intent: "", kind: "" },
    { text: "换了个地方", node: "b2", intent: "where", kind: "" },
    { text: "背对着我", node: "b2", intent: "gaze", kind: "away" },
    { text: "最后", node: "b3", intent: "", kind: "" },
    { text: "床头", node: "b3", intent: "where", kind: "bedside" },
    { text: "帽子大得遮住了半个房间", node: "man", intent: "hat", kind: "absurd" },
  ],
};

// Into a tree the way any model's dream is (the router's applyAnswer), then the player's conventions.
const BLANK: Tree = { scene: "dream", title: L("", ""), prompt: "", by: { who: "code" }, nodes: [] };
export const TREE: Tree = shape(applyAnswer(BLANK, FIRST, { kind: "dream", text: FIRST_PROMPT }, { who: "model:strong", event: "wrote the dream" }).tree);

// -----------------------------------------------------------------------------
// The stand-in for the strong model, for a new dream: the words cut into
// beats, each read for where he is, the door, his gaze, by the library's
// words. Where a beat does not say, it guesses (he comes closer each time) and
// is unsure, so the player asks. A real model does this better; this one says
// it is a stand-in.
// -----------------------------------------------------------------------------

const CLOSER = ["inside", "window", "room", "foot", "bedside"];

/** The option the words say (its longest aka), and the words that say it: the option's own words, if they are there whole. */
function found(s: string, options: Record<string, Option>): { id: string; word: string; at: number } | null {
  let best: { id: string; word: string; at: number } | null = null;
  for (const [id, o] of Object.entries(options))
    for (const w of o.aka) {
      const at = s.indexOf(w);
      if (at >= 0 && (!best || w.length > best.word.length)) best = { id, word: w, at };
    }
  if (!best) return null;
  const words = options[best.id].words;
  const k = words ? words.indexOf(best.word) : -1;
  if (words && k >= 0 && s.slice(best.at - k, best.at - k + words.length) === words) return { ...best, word: words, at: best.at - k };
  return best;
}

export function compose(text: string): Answer {
  const lines = text
    .split(/[。！？!?\n；;]|然后|后来|接着|最后|再后来/)
    .map((s) => s.replace(/^[，,\s]+|[，,\s]+$/g, ""))
    .filter((s) => s.length >= 2)
    .slice(0, 5);
  if (!lines.length) lines.push(text.trim() || "他在");
  const n = lines.length;
  let door = "shut";
  // Words → tree, as the beats are read: where each says it (in the whole text), sorted into reading order at the end.
  const bound: (Answer["spans"][number] & { at: number })[] = [];
  let cursor = 0;
  const beats = lines.map((line, i): BeatSpec => {
    const id = `b${i + 1}`;
    const lineAt = text.indexOf(line, cursor);
    // The word that starts the beat ("然后"), just before it or at its start.
    const gap = text.slice(cursor, lineAt + 3);
    const cue = /一开始|然后|后来|接着|最后/.exec(gap);
    if (cue) bound.push({ text: cue[0], node: id, intent: "", kind: "", at: cursor + cue.index });
    cursor = lineAt + line.length;
    // "衣柜门" is the door, not him in the wardrobe (masked, so the places do not see it).
    const masked = line.replace(/衣?柜门/g, (m) => "＿".repeat(m.length));
    const gone = /不见了?|消失了?|不在|走了/.exec(line);
    const place = gone ? { id: "gone", word: gone[0], at: gone.index } : found(masked, PLACES);
    const doorWords = found(line, DOORS);
    const gazeWords = found(line, GAZES);
    for (const [hit, intent] of [[place, "where"], [doorWords, "door"], [gazeWords, "gaze"]] as const)
      if (hit) bound.push({ text: hit.word, node: id, intent, kind: hit.id, at: lineAt + hit.at });
    const said = place?.id ?? null;
    const guess = n === 1 ? "bedside" : CLOSER[Math.round((i / (n - 1)) * (CLOSER.length - 1))];
    const where = said ? { [said]: 0.85 } : { [guess]: 0.5, [guess === "bedside" ? "foot" : "bedside"]: 0.35 };
    door = doorWords?.id ?? (said === "inside" && door === "shut" ? "ajar" : door);
    const gaze = gazeWords?.id ?? null;
    return {
      line,
      where,
      door: { [door]: 0.75 },
      gaze: gaze ? { [gaze]: 0.85 } : { me: 0.6 },
      hold: { [line.length > 14 ? "long" : "brief"]: 0.65 },
    };
  });
  const hat: Record<string, number> = /帽子.*(离谱|巨大|夸张|遮住|大得)/.test(text) ? { absurd: 0.8 } : /帽子.*(正常|普通|小)/.test(text) ? { usual: 0.7 } : {};
  const hatWords = /帽子[^，。,.]*/.exec(text);
  if (hatWords) bound.push({ text: hatWords[0], node: "man", intent: "hat", kind: Object.keys(hat)[0] ?? "", at: hatWords.index });
  // Overlaps (a word read twice) keep the first.
  const spans: Answer["spans"] = [];
  let end = -1;
  for (const x of bound.sort((p, q) => p.at - q.at))
    if (x.at >= end) {
      spans.push({ text: x.text, node: x.node, intent: x.intent, kind: x.kind });
      end = x.at + x.text.length;
    }
  const asked = beats.filter((b) => Math.max(...Object.values(b.where)) < 0.6).length;
  return {
    ...EMPTY,
    note_zh: `（替身）按句子切成 ${n} 幕，按词库读他在哪、柜门、目光；${asked ? `${asked} 幕没说他在哪，猜的，会问你` : "每一幕都说了他在哪"}`,
    note_en: `(stand-in) Cut into ${n} beats by sentence, read for where he is, the door, his gaze by the library's words; ${asked ? `${asked} did not say where he is: guessed, and will ask` : "each says where he is"}`,
    title_zh: lines[0].slice(0, 12),
    title_en: `A dream in ${n} ${n === 1 ? "beat" : "beats"}`,
    nodes: [castNode(hat), ...beats.map((b, i) => beatNode(i, b))],
    phases: beats.map((_, i) => `b${i + 1}`),
    spans,
  };
}

// -----------------------------------------------------------------------------
// The host: what a real model is told; the stand-in's answers.
// -----------------------------------------------------------------------------

const places = Object.entries(PLACES)
  .map(([k, o]) => `${k} ${JSON.stringify(o.realize)}`)
  .join(" · ");

export const GRAMMAR = `Scene: a child's bedroom at night, 390 × 844 scene units (a phone held upright), y down. The floor line is y 640; the bed's blanket fills y 690–844; the wardrobe stands x 200–372, y 200–642; the window x 40–152, y 172–386.
Library things (draws): man (very tall, thin, in black, a huge round hat; feet at his anchor, 419 units tall at scale 1), wardrobe, window, bed, room.
A dream is played in beats. The cast: one node "man" (draws "man") with intent "hat" { hatScale: 1 usual … 1.95 absurd }. Each beat is a node (ids b1, b2, …; "phases" lists them in order); its prompt is the beat's own words, shown as it plays. A beat's intents:
  where { at: [x, y] his feet, scale (1 at y 640, about 1.9 at y 872), lean (degrees), inside: true when in the wardrobe, absent: true when he is not there } — library places: ${places}
  door { open 0–0.9 } (the wardrobe door) · gaze { eyes 0–1 } · hold { over: seconds the beat lasts, 3–8 }.
Give each intent a few kinds with beliefs; where the words do not say, believe less and set resolve "ask".
A new thing (said of the room) has intents "place" { at: [x, y] its base, scale } and, if it gives light, "light" { on: true | false }. Its svg is drawn with its base at the origin, about 80 units wide and up to 120 tall at scale 1.`;

function recorded(need: Need): Answer | null {
  if (need.kind === "dream") return compose(need.text);
  return recordedThing(need);
}

export const HOST: Host = {
  scene: "dream",
  grammar: GRAMMAR,
  recorded,
  recordedDrawing,
  placeName,
  shape,
};
