import { createAnthropic } from "@ai-sdk/anthropic";
import { gateway, generateText, type LanguageModel } from "ai";
import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// The Intent Lab's models (app/lab/intent/events.ts). A strong model drives
// everything; a weak one is a short path through what it wrote.
//
//   author   strong   the whole intent tree from the scene: intents, kinds,
//                     patches, and the vocabulary (what a person says and
//                     does that means each kind)
//   add      strong   one new intent for an event no kind fits, with the
//                     vocabulary for that event
//   select   weak     only a choice within the tree: decide a kind, believe,
//                     or none (and whether a strong model should add)
//
// The models never touch the scene: they write intents, within the knobs the
// stage already has, and the page checks every answer (`admit`) before it is
// let in.
//
// Which models: INTENT_WEAK_MODEL / INTENT_STRONG_MODEL, gateway ids, on
// Vercel (or with AI_GATEWAY_API_KEY); by default the gateway's free tier
// (Qwen 3.5 Flash, Gemini 2.5 Flash; a Claude model needs gateway credits).
// With only ANTHROPIC_API_KEY, Haiku and Sonnet. With neither, 501, and the
// page's stand-ins.
// =============================================================================

export const maxDuration = 60;

const MAX_BODY = 40_000;

type Mode = "select" | "add" | "author";

function resolveModel(mode: Mode): { model: LanguageModel; id: string } | null {
  const strong = mode !== "select";
  if (process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    const id = strong
      ? (process.env.INTENT_STRONG_MODEL ?? "google/gemini-2.5-flash")
      : (process.env.INTENT_WEAK_MODEL ?? "alibaba/qwen3.5-flash");
    return { model: gateway(id), id };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const id = strong ? "claude-sonnet-5-5" : "claude-haiku-5-5";
    return { model: createAnthropic()(id), id: `anthropic/${id}` };
  }
  return null;
}

const WORLD = `You keep the intent tree of a small interactive scene (a dream on a web page).

An intent is one closed choice about one thing on the stage: 2-4 kinds, each with a "patch" that sets some of that thing's knobs. People decide intents; a model may believe things about them; code fills in the rest. Precedence: a person's decision > their preference > a model's belief when sure > code. Never override what a person decided.

An intent node: {"type":"<short camelCase>","of":"<entity id, or id#member>","words":{"en":"...","zh":"..."},"kinds":{"<kind>":{"words":{"en":"...","zh":"..."},"patch":{"<entity>":{"<knob>":<value>}}}, ...},"resolve":"switch"|"ask","question":{"en":"...","zh":"..."},"prior":{"<kind>":<0..1>},"say":{"<kind>":["<what a person says that means it>", ...]},"gestures":{"<kind>":[{"from":"self"|"<entity>","dir":"up|down|left|right|horizontal|vertical","into":"<entity>","outOf":"<entity>"}]}}
- The first kind is the scene as written: its patch is the values the scene wrote. Every kind sets the same knobs.
- Only knobs listed on an entity; read each knob's note for which way it goes; numbers within its range.
- "resolve":"ask" only for what the scene means (ask the person when unsure); otherwise "switch".
- "say": short phrases in English and Chinese, lower case. "gestures": drags that would mean it (from "self" is the thing the intent is about).`;

const SYSTEM: Record<Mode, string> = {
  select: `${WORLD}

You are the fast path. You may ONLY choose within the existing tree. Answer ONE JSON object, nothing else:
- {"action":"decide","key":"<key, copied exactly>","kind":"<one of that intent's kinds>","why":"..."}  the event means that kind.
- {"action":"believe","beliefs":[{"key":"<key>","p":{"<kind>":0.7,"<kind>":0.3}}],"why":"..."}  a mood or a general wish, over several intents.
- {"action":"none","escalate":true,"why":"..."}  no kind fits, but a knob listed on an entity could express it: a new intent is needed.
- {"action":"none","escalate":false,"why":"..."}  no knob on the stage can express it.
Keep "why" to one sentence.`,
  add: `${WORLD}

A faster model found no kind that fits the event. Write ONE new intent node that does, using only knobs on the stage, with "say" or "gestures" that include this very event. Answer ONE JSON object, nothing else:
- {"action":"add","node":{...the node...},"kind":"<the kind the event means, one of the node's own kinds>","why":"..."}
- {"action":"none","why":"<what no knob can do, and what would be needed>"}`,
  author: `${WORLD}

Author the whole intent tree for this scene: every choice a person could mean that its knobs can express, about its things and (where a choice is per member) each member. Include each intent's vocabulary. If a choice should depend on the screen's shape (tall vs wide), give it "index":{"by":"tallness","base":"<kind on tall screens>"}. Answer ONE JSON object, nothing else:
{"tree":[...nodes...],"beliefs":[{"key":"<type>|<of>","p":{"<kind>":<0..1>}}],"why":"<one sentence>"}`,
};

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too much to observe" }, { status: 413 });
  let body: { mode?: Mode; event?: { kind?: string; text?: string }; tree?: { type: string; of: string; kinds: Record<string, unknown> }[] };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "not JSON" }, { status: 400 });
  }
  const mode: Mode = body.mode === "add" || body.mode === "author" ? body.mode : "select";
  if (body.event?.kind === "prompt" && (body.event.text ?? "").length > 500) {
    return NextResponse.json({ error: "a prompt that long is not one intent" }, { status: 413 });
  }
  const resolved = resolveModel(mode);
  if (!resolved) return NextResponse.json({ error: "no model is configured" }, { status: 501 });
  try {
    const { text: out } = await generateText({
      model: resolved.model,
      system: SYSTEM[mode],
      // The intents' keys and kinds spelled out, so a decision names them exactly.
      prompt: `Intents (key: kinds): ${(body.tree ?? []).map((n) => `${n.type}|${n.of}: ${Object.keys(n.kinds ?? {}).join(", ")}`).join("; ") || "none yet"}\n\n${JSON.stringify(body)}`,
      maxOutputTokens: mode === "author" ? 8000 : 1500,
    });
    const answer = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    return NextResponse.json({ answer, model: resolved.id });
  } catch (error) {
    return NextResponse.json({ error: `the model's answer could not be read: ${(error as Error).message.slice(0, 200)}`, model: resolved.id }, { status: 502 });
  }
}
