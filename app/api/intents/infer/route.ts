import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

/**
 * ② infer, by a real model: what an experience's intent loop sends when no
 * preset reads an event (packages/intents/src/router.ts).
 *
 *   tier "weak"    a kind more on an intent the tree has      → Claude Haiku 5.5, low effort
 *   tier "strong"  a new thing, a drawing, a whole new dream  → Claude Opus 5.5, high effort,
 *                                                               refusals fall back server-side
 *
 * The answer is constrained to one JSON shape (structured outputs), the same
 * one the client's stand-in returns. Without credentials it answers 501 and
 * the client stands in with recorded answers, saying so.
 */

const MODELS = { weak: "claude-haiku-5-5", strong: "claude-opus-5-5" } as const;

const str = { type: "string" } as const;
const strs = { type: "array", items: str } as const;
const REALIZE = {
  type: "object",
  additionalProperties: false,
  required: ["field", "num", "x", "y", "flag"],
  properties: { field: str, num: { type: ["number", "null"] }, x: { type: ["number", "null"] }, y: { type: ["number", "null"] }, flag: { type: ["boolean", "null"] } },
};
const KIND = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label_zh", "label_en", "aka", "realize", "p"],
  properties: { id: str, label_zh: str, label_en: str, aka: strs, realize: { type: "array", items: REALIZE }, p: { type: "number" } },
};
const INTENT = {
  type: "object",
  additionalProperties: false,
  required: ["name", "label_zh", "label_en", "aka", "resolve", "ordered", "kinds"],
  properties: { name: str, label_zh: str, label_en: str, aka: strs, resolve: { type: "string", enum: ["ask", "switch"] }, ordered: { type: "boolean" }, kinds: { type: "array", items: KIND } },
};
const NODE = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label_zh", "label_en", "aka", "prompt", "draws", "svg", "intents"],
  properties: { id: str, label_zh: str, label_en: str, aka: strs, prompt: str, draws: { type: ["string", "null"] }, svg: { type: ["string", "null"] }, intents: { type: "array", items: INTENT } },
};
const ANSWER = {
  type: "object",
  additionalProperties: false,
  required: ["note_zh", "note_en", "kinds", "nodes", "picks", "phases", "title_zh", "title_en", "spans", "beliefs"],
  properties: {
    note_zh: str,
    note_en: str,
    kinds: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["node", "intent", "kind"], properties: { node: str, intent: str, kind: KIND } },
    },
    nodes: { type: "array", items: NODE },
    picks: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["node", "intent", "kind"], properties: { node: str, intent: str, kind: str } },
    },
    phases: strs,
    title_zh: str,
    title_en: str,
    spans: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["text", "node", "intent", "kind"], properties: { text: str, node: str, intent: str, kind: str } },
    },
    beliefs: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["node", "intent", "kind", "p"], properties: { node: str, intent: str, kind: str, p: { type: "number" } } },
    },
  },
};
const DRAWING = { type: "object", additionalProperties: false, required: ["svg"], properties: { svg: str } };

const SYSTEM = `You keep an interactive experience's intent tree: the things in it, and on each a few intents, each a closed set of kinds with what each kind means in the picture ("realize") and your belief over the kinds ("p").

A person's event could not be read by any preset intent. You are shown the tree, everything the person has said, and what is needed. Answer in the given JSON shape, changing the tree as little as it takes:
- "kinds": kinds to add to intents the tree already has (learn-at, learn-value, extend). Give each a short id, labels in Chinese and English, words people would use (aka), realize fields of the same names the intent's other kinds use, and p (your belief in it, 0-1).
- "nodes": things to add (new-thing), each with its own intents. A thing the library can draw names it in "draws"; otherwise "draws" is null and, if you can, "svg" is its drawing (see the grammar).
- "picks": the person's part of the event: pick the kind you added for them.
- For a new dream ("dream" need): "nodes" is the whole cast, with one node per beat (each with the intents the grammar lists for a beat) and "phases" the beats' ids in order; give a title. Bind the words: "spans" lists, in reading order, exact stretches of the dream's text and what each is about (a node; an intent of it; the kind it says; "" where none).
- The tree's <words> shows the prompt with each bound stretch marked [words](node.intent=kind). A "reword" need: the person rewrote a stretch; add the kind the new words say (or, with no intent, change the thing) and pick it. An "unsay" need: the person deleted a stretch that was your evidence; give "beliefs" for that intent again (one row per kind), without it.
- Leave arrays empty when not used; "note_zh" / "note_en" say in one line what you did.
Never remove what a person picked. Keep realize values in the scene's units.`;

const DRAW_SYSTEM = `You draw one thing for an SVG scene, as an SVG fragment (no <svg> element): only shapes (path, rect, circle, ellipse, polygon, line, g), fills and strokes; no script, no event attributes, no links, no images, no text. Its origin is the thing's anchor (where it stands); up is negative y; size it in the scene's units as the grammar says. Moonlit night palette: deep blues, near-black, a little warm light only if it is a light.`;

export async function POST(request: NextRequest) {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return NextResponse.json({ error: "No model credentials: the client stands in." }, { status: 501 });
  }
  const body = (await request.json()) as { task: "infer" | "draw"; tier: "weak" | "strong"; observation: string; need?: unknown; node?: unknown; grammar: string };
  const tier = body.tier === "weak" ? "weak" : "strong";
  const model = MODELS[tier];
  const draw = body.task === "draw";
  const content = draw
    ? `<grammar>\n${body.grammar}\n</grammar>\n${body.observation}\n<draw>${JSON.stringify(body.node)}</draw>`
    : `<grammar>\n${body.grammar}\n</grammar>\n${body.observation}\n<need-json>${JSON.stringify(body.need)}</need-json>`;
  const format = { type: "json_schema" as const, schema: draw ? DRAWING : ANSWER };

  try {
    const response =
      tier === "strong"
        ? await client.beta.messages.create({
            model,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "high", format },
            system: draw ? DRAW_SYSTEM : SYSTEM,
            messages: [{ role: "user", content }],
          } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming)
        : await client.messages.create({
            model,
            max_tokens: 8000,
            output_config: { effort: "low", format },
            system: SYSTEM,
            messages: [{ role: "user", content }],
          } as unknown as Anthropic.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") return NextResponse.json({ error: "Refused." }, { status: 422 });
    const text = response.content.find((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")?.text;
    if (!text) return NextResponse.json({ error: "No answer." }, { status: 502 });
    return NextResponse.json({ answer: JSON.parse(text), model: response.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "No model credentials: the client stands in." }, { status: 501 });
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Rate limited." }, { status: 429 });
    if (error instanceof Anthropic.APIError) return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "The answer was not JSON." }, { status: 502 });
    // No credentials resolved, or the API unreachable: the SDK's own error, not the API's.
    return NextResponse.json({ error: `No model reachable: the client stands in. (${error instanceof Error ? error.message : String(error)})` }, { status: 501 });
  }
}
