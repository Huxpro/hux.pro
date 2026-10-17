// =============================================================================
// Things any dream's tree can be asked for, and the strong model's answers for
// them, recorded: for when no model is reachable (and, for each, its drawing).
// A real model answers the same shape (packages/intents, router.ts: Answer).
//
// Also the room's places by name, for kinds a drag teaches (learn-at).
// =============================================================================

import type { Answer, Host, Node, Pt, Text } from "intents";
import { fromRealize } from "intents";

export const L = (zh: string, en: string): Text => ({ zh, en });

export type Need = Parameters<NonNullable<Host["recorded"]>>[0];

/** A kind, in the answer's shape. */
export const kind = (id: string, zh: string, en: string, aka: string[], realize: Record<string, unknown>, p: number) => ({
  id,
  label_zh: zh,
  label_en: en,
  aka,
  realize: fromRealize(realize),
  p,
});

export const EMPTY = { kinds: [], nodes: [], picks: [], phases: [], title_zh: "", title_en: "", spans: [], beliefs: [] };

/** A lamp, a cat: new things with their own intents, to be drawn. */
export function recordedThing(need: Need): Answer | null {
  const text = "text" in need ? need.text.toLowerCase() : "";
  if (need.kind === "new-thing" && /灯|lamp|light/.test(text)) {
    return {
      ...EMPTY,
      note_zh: "树里没有灯：加一样新东西，带两个意图（放在哪、亮不亮）；它的样子要画，先用占位",
      note_en: "No lamp in the tree: a new thing with two intents (where, on or off); its look must be drawn, a placeholder till then",
      nodes: [
        {
          id: "lamp",
          label_zh: "灯",
          label_en: "the lamp",
          aka: ["灯", "台灯", "lamp"],
          prompt: need.text,
          draws: null,
          svg: null,
          intents: [
            {
              name: "place",
              label_zh: "放在哪",
              label_en: "where it is",
              aka: ["放", "挪"],
              resolve: "switch",
              ordered: false,
              kinds: [kind("nightstand", "床头柜上", "on the nightstand", ["床头柜"], { at: [352, 738], scale: 1 }, 0.82), kind("floor", "地上", "on the floor", ["地上", "地板"], { at: [52, 772], scale: 1.25 }, 0.18)],
            },
            {
              name: "light",
              label_zh: "亮不亮",
              label_en: "on or off",
              aka: ["灯光"],
              resolve: "switch",
              ordered: false,
              kinds: [kind("on", "亮着", "on", ["开灯", "亮着", "打开灯"], { on: true }, 0.86), kind("off", "关着", "off", ["关灯", "熄灯"], { on: false }, 0.14)],
            },
          ],
        },
      ],
    };
  }
  if (need.kind === "new-thing" && /猫|cat/.test(text)) {
    return {
      ...EMPTY,
      note_zh: "树里没有猫：加一只，带一个意图（在哪）；它的样子要画，先用占位",
      note_en: "No cat in the tree: one, with an intent (where it is); its look must be drawn, a placeholder till then",
      nodes: [
        {
          id: "cat",
          label_zh: "猫",
          label_en: "the cat",
          aka: ["猫", "cat"],
          prompt: need.text,
          draws: null,
          svg: null,
          intents: [
            {
              name: "place",
              label_zh: "在哪",
              label_en: "where it is",
              aka: ["在", "放"],
              resolve: "switch",
              ordered: false,
              kinds: [kind("bed", "床上", "on the bed", ["床上"], { at: [96, 722], scale: 1.1 }, 0.7), kind("floor", "地上", "on the floor", ["地上"], { at: [180, 680], scale: 0.9 }, 0.3)],
            },
          ],
        },
      ],
    };
  }
  return null;
}

/** The strong model's drawings, recorded. Base at the origin, night palette. */
export const DRAWINGS: Record<string, string> = {
  lamp: `<rect x="-30" y="-6" width="60" height="10" fill="#141a2c"/><rect x="-15" y="-11" width="30" height="6" rx="2" fill="#1d2540"/><rect x="-2" y="-58" width="4" height="48" fill="#1d2540"/><path d="M -21 -56 L 21 -56 L 13 -86 L -13 -86 Z" fill="#2a3456"/>`,
  cat: `<path d="M -26 0 C -30 -14 -24 -28 -8 -30 C -6 -38 -2 -44 2 -44 L 6 -36 L 12 -44 C 16 -42 17 -34 14 -28 C 24 -24 30 -12 28 0 Z" fill="#06080f"/><path d="M 26 -4 C 40 -6 42 -20 36 -26" fill="none" stroke="#06080f" stroke-width="4" stroke-linecap="round"/><circle cx="2" cy="-34" r="1.4" fill="#c9d48a"/><circle cx="9" cy="-34" r="1.4" fill="#c9d48a"/>`,
};

export const recordedDrawing = (node: Node) => DRAWINGS[node.id] ?? null;

/** The room's places, by name. */
export function placeName(at: Pt): Text {
  const [x, y] = at;
  if (y < 650) return L("房间深处", "far back");
  if (x > 300 && y > 760) return L("床尾外", "past the foot of the bed");
  if (x < 150) return L("窗下", "under the window");
  return L("房间中间", "in the middle of the room");
}

// -----------------------------------------------------------------------------
// Answers a strong model wrote in a session (through the dev bridge: the route
// keeps them in content/scenes/<scene>.claude.json), replayed for the same need
// when no model is reachable.
// -----------------------------------------------------------------------------

export interface SessionEntry {
  at: string;
  task: "infer" | "draw";
  need?: unknown;
  node?: { id: string };
  answer: unknown;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The session's answer for this need (the latest), if there is one. */
export const sessionAnswer = (list: SessionEntry[]) => (need: Need) =>
  (list.filter((e) => e.task === "infer" && same(e.need, need)).at(-1)?.answer as Answer | undefined) ?? null;

/** The session's drawing for this thing (the latest), if there is one. */
export const sessionDrawing = (list: SessionEntry[]) => (node: Node) =>
  (list.filter((e) => e.task === "draw" && e.node?.id === node.id).at(-1)?.answer as { svg: string } | undefined)?.svg ?? null;
