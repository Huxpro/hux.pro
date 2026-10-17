import { createAnthropic } from "@ai-sdk/anthropic";
import { gateway, generateText, NoObjectGeneratedError, Output, type LanguageModel } from "ai";
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

An intent node: {"type":"<short camelCase>","of":"<the entity it is about: an entity id such as \"dust\", or one member of a population as id#index such as \"moments#2\"; never a knob>","words":{"en":"...","zh":"..."},"kinds":{"<kind>":{"words":{"en":"...","zh":"..."},"patch":{"<entity>":{"<knob>":<value>}}}, ...},"resolve":"switch"|"ask","question":{"en":"...","zh":"..."},"prior":{"<kind>":<0..1>},"say":{"<kind>":["<what a person says that means it>", ...]},"gestures":{"<kind>":[{"from":"self"|"<entity>","dir":"up|down|left|right|horizontal|vertical","into":"<entity>","outOf":"<entity>"}]}}
- The first kind is the scene as written: its patch is the values the scene wrote. Every kind sets the same knobs.
- Only knobs listed on an entity; read each knob's note for which way it goes; numbers within its range.
- "resolve":"ask" only for what the scene means (ask the person when unsure); otherwise "switch".
- "say": short phrases in English and Chinese, lower case. "gestures": drags that would mean it (from "self" is the thing the intent is about).`;

const SYSTEM: Record<Mode, string> = {
  select: `${WORLD}

You are the fast path. You may ONLY choose within the existing tree. A kind means only what its patch sets (each kind is listed with the knobs it sets): when the words ask for something no kind's knobs set (a colour where no kind sets a colour; a thing that is not on the stage), that is NOT the nearest kind: answer none. Say how sure you are ("sure", 0 to 1, that this is what the person means; below 0.7 a stronger model decides instead, so do not overstate it). Answer ONE JSON object, nothing else:
- {"action":"decide","key":"<key, copied exactly>","kind":"<one of that intent's kinds>","sure":0.9,"why":"..."}  the event plainly means that kind.
- {"action":"believe","beliefs":[{"key":"<key>","p":{"<kind>":0.7,"<kind>":0.3}}],"sure":0.8,"why":"..."}  a mood or a general wish, over several intents (a mood is never a decision).
- {"action":"none","escalate":true,"why":"..."}  no kind fits, but a knob listed on an entity could express it: a new intent is needed.
- {"action":"none","escalate":false,"why":"..."}  no knob on the stage can express it.
Keep "why" to one sentence.`,
  add: `${WORLD}

A faster model was not sure what the event means, or found no kind that fits. Decide it. Answer ONE JSON object, nothing else:
- {"action":"decide","key":"<key, copied exactly>","kind":"<one of its kinds>","why":"..."}  it does mean an existing kind.
- {"action":"believe","beliefs":[{"key":"<key>","p":{"<kind>":0.7,"<kind>":0.3}}],"why":"..."}  a mood or a general wish (never a decision).
- {"action":"add","node":{...a new intent node...},"kind":"<the kind the event means, one of the node's own kinds>","why":"..."}  no kind fits, but knobs on the stage can express it; include this very event in its "say" or "gestures".
- {"action":"none","why":"<what no knob can do>","needs":[{"of":"<entity id>","knob":"<camelCase name of the knob it lacks>","note":"<what that knob would do, with its values>"}]}  nothing on the stage can express it (a drag that reorders things, when no knob orders them, is this). Before answering none, read every entity's knobs and their notes: a knob that can express it, however it is named, means "add". "needs" names what code would have to add for it; leave it out when no knob could.`,
  author: `${WORLD}

Author the whole intent tree for this scene: the choices a person is most likely to mean that its knobs can express (at most 10 intents), about its things and, where a choice is per member, each member.
REQUIRED for every intent: "say" with 2-4 short phrases for EVERY kind (English and Chinese); "gestures" wherever a drag on the stage could mean a kind (from the thing, which way, or out of / into the window). Without them a person's words and drags have no fast path to the intent.
REQUIRED: "beliefs", one per intent: your distribution over its kinds for this scene as written. "resolve":"ask" only for an intent that is the scene's meaning and you are unsure of; everything else "switch". If a choice should depend on the screen's shape (tall vs wide), give it "index":{"by":"tallness","base":"<kind on tall screens>"}. Answer ONE JSON object, nothing else:
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
    const result = await generateText({
      model: resolved.model,
      system: SYSTEM[mode],
      // The intents' keys and kinds spelled out, each with what it sets, so a decision names them exactly and means what it sets.
      prompt: `Intents (key: kind {what it sets}, ...):\n${(body.tree ?? []).map((n) => `${n.type}|${n.of}: ${Object.entries(n.kinds ?? {}).map(([k, kn]) => `${k} {${sets(kn)}}`).join(", ")}`).join("\n") || "none yet"}\n\n${JSON.stringify(body)}`,
      // Room for the answer after any thinking (Gemini 2.5 thinks by default, and its thinking counts here).
      maxOutputTokens: mode === "author" ? 24000 : 8000,
      providerOptions: { google: { thinkingConfig: { thinkingBudget: mode === "select" ? 0 : 1024 } } },
      // JSON mode where the provider has one: a long tree written as free text breaks somewhere.
      output: Output.json(),
    });
    return NextResponse.json({ answer: result.output ?? readJson(result.text), model: resolved.id });
  } catch (error) {
    // JSON mode refused what came back: read it as text (fenced, or with words around it), and say what it was if that fails too.
    const text = NoObjectGeneratedError.isInstance(error) ? (error.text ?? "") : "";
    try {
      if (text) return NextResponse.json({ answer: readJson(text), model: resolved.id });
    } catch {}
    return NextResponse.json(
      { error: `the model's answer could not be read: ${(error as Error).message.slice(0, 160)}${text ? ` (it began: ${text.slice(0, 120)})` : ""}`, model: resolved.id },
      { status: 502 },
    );
  }
}

/** What a kind sets, as "thing.knob=value". */
function sets(kind: unknown): string {
  const patch = ((kind ?? {}) as { patch?: Record<string, Record<string, unknown>> }).patch ?? {};
  return Object.entries(patch)
    .flatMap(([thing, props]) => Object.entries(props ?? {}).map(([k, v]) => `${thing}.${k}=${JSON.stringify(v)}`))
    .join(" ");
}

/** The JSON object in a model's text: inside a ```json fence, or between the first { and the last }. */
function readJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  return JSON.parse(body.slice(body.indexOf("{"), body.lastIndexOf("}") + 1));
}
