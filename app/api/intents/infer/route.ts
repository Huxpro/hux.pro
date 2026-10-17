import Anthropic from "@anthropic-ai/sdk";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  required: ["id", "label_zh", "label_en", "aka", "prompt", "draws", "svg", "intents", "fills", "drawings"],
  properties: {
    id: str,
    label_zh: str,
    label_en: str,
    aka: strs,
    prompt: str,
    draws: { type: ["string", "null"] },
    svg: { type: ["string", "null"] },
    intents: { type: "array", items: INTENT },
    fills: { type: ["string", "null"] },
    drawings: { type: "array", items: { type: "object", additionalProperties: false, required: ["intent", "kind", "svg"], properties: { intent: str, kind: str, svg: str } } },
  },
};
const ANSWER = {
  type: "object",
  additionalProperties: false,
  required: ["note_zh", "note_en", "kinds", "nodes", "picks", "phases", "title_zh", "title_en", "spans", "beliefs", "remove", "carry", "rebind", "scope", "plan_zh", "plan_en"],
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
    remove: { type: "array", items: { type: "object", additionalProperties: false, required: ["node", "intent"], properties: { node: str, intent: str } } },
    carry: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from_node", "from_intent", "from_kind", "node", "intent", "kind"],
        properties: { from_node: str, from_intent: str, from_kind: str, node: str, intent: str, kind: str },
      },
    },
    rebind: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["text", "node", "intent", "kind"], properties: { text: str, node: str, intent: str, kind: str } },
    },
    scope: { type: "string", enum: ["tree", "code"] },
    plan_zh: str,
    plan_en: str,
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
- Structural answers, when the person's words make part of the tree meaningless (a hat that is now an umbrella): "remove" the intents (or the whole thing: intent "") that no longer mean anything; add the new thing in "nodes" ("fills" the library slot the old one was drawn in, e.g. "man.hat", so it rides with its owner; "drawings" per kind of an intent its look depends on); "carry" each of the person's picks that still means something into the new part's terms; "rebind" the words to what they are about now. These are shown to the person as a proposal before they apply.
- If the tree and the library cannot say it at all (it changes what the experience's code does), set "scope" to "code", change nothing, and write the plan (plan_zh, plan_en): what the code must do, and what of the tree would carry over. Otherwise scope is "tree" and the plan says in a line what the change is.
Never drop a person's pick silently: carry it, or say in the note why it no longer means anything. Keep realize values in the scene's units.`;

const DRAW_SYSTEM = `You draw one thing for an SVG scene, as an SVG fragment (no <svg> element): only shapes (path, rect, circle, ellipse, polygon, line, g), fills and strokes; no script, no event attributes, no links, no images, no text. Its origin is the thing's anchor (where it stands); up is negative y; size it in the scene's units as the grammar says. Moonlit night palette: deep blues, near-black, a little warm light only if it is a light.`;

const BRIDGE = process.env.NODE_ENV !== "production" && process.env.INTENTS_BRIDGE ? join(process.cwd(), ".intents-bridge") : null;
const hasCredentials = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

/** A strong request, handed to the model working in this repository; its answer, when it writes one (15 minutes at most). */
async function viaBridge(dir: string, req: Record<string, unknown>): Promise<unknown | null> {
  await mkdir(dir, { recursive: true });
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await writeFile(join(dir, `${id}.request.json`), JSON.stringify({ id, at: new Date().toISOString(), ...req }, null, 2));
  const answer = join(dir, `${id}.answer.json`);
  for (let waited = 0; waited < 15 * 60_000; waited += 500) {
    if (existsSync(answer)) {
      const text = await readFile(answer, "utf8");
      await rename(answer, join(dir, `${id}.answered.json`));
      return JSON.parse(text);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** Kept by scene, for the experiences to replay when no model is reachable. */
async function keep(scene: string, entry: Record<string, unknown>) {
  if (!/^[a-z0-9-]+$/.test(scene)) return;
  const file = join(process.cwd(), "content", "scenes", `${scene}.claude.json`);
  const list = existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as unknown[]) : [];
  list.push({ at: new Date().toISOString(), ...entry });
  await writeFile(file, JSON.stringify(list, null, 2) + "\n");
}

export async function POST(request: NextRequest) {
  let client: Anthropic;
  try {
    client = new Anthropic();
  } catch {
    return NextResponse.json({ error: "No model credentials: the client stands in." }, { status: 501 });
  }
  const body = (await request.json()) as { task: "infer" | "draw"; tier: "weak" | "strong"; observation: string; need?: unknown; node?: unknown; grammar: string; scene?: string };
  const tier = body.tier === "weak" ? "weak" : "strong";
  const model = MODELS[tier];
  const draw = body.task === "draw";
  const content = draw
    ? `<grammar>\n${body.grammar}\n</grammar>\n${body.observation}\n<draw>${JSON.stringify(body.node)}</draw>`
    : `<grammar>\n${body.grammar}\n</grammar>\n${body.observation}\n<need-json>${JSON.stringify(body.need)}</need-json>`;
  const format = { type: "json_schema" as const, schema: draw ? DRAWING : ANSWER };

  if (BRIDGE && !hasCredentials() && tier === "strong") {
    const answer = await viaBridge(BRIDGE, { task: body.task, tier, scene: body.scene, need: body.need, node: body.node, system: draw ? DRAW_SYSTEM : SYSTEM, content, schema: format.schema });
    if (!answer) return NextResponse.json({ error: "No answer came through the bridge." }, { status: 504 });
    if (body.scene) await keep(body.scene, draw ? { task: "draw", node: body.node, answer } : { task: "infer", need: body.need, answer });
    return NextResponse.json({ answer, model: "claude (a Claude Code session, through the dev bridge)" });
  }

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
