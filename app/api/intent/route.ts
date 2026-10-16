import { createAnthropic } from "@ai-sdk/anthropic";
import { gateway, generateText, type LanguageModel } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { ASK_MODELS } from "@/systems/ask/lib/models";

// =============================================================================
// The Intent Lab's model: ② of its event loop (app/lab/intent/events.ts).
//
// An event no preset recognised arrives with what the model needs to observe
// it: the things on the stage and their knobs, the intent tree, what people
// decided, the event, earlier prompts. The model answers with one action, as
// JSON; the page checks it against the stage (`admit`) before it is let in.
// The model never touches the scene: it writes intents, and only within the
// knobs the stage already has.
//
// Which model, as Ask's route: the gateway on Vercel (its free-tier default),
// Anthropic's own key when set, else 501 and the page's stand-in.
// =============================================================================

export const maxDuration = 30;

const MAX_BODY = 40_000;

function resolveModel(): { model: LanguageModel; id: string } | null {
  if (process.env.VERCEL || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return { model: gateway(ASK_MODELS[0].id), id: ASK_MODELS[0].id };
  }
  if (process.env.ANTHROPIC_API_KEY) return { model: createAnthropic()("claude-haiku-5-5"), id: "anthropic/claude-haiku-5-5" };
  return null;
}

const SYSTEM = `You maintain the intent tree of a small interactive scene (a dream on a web page).

An intent is one closed choice about one thing on the stage: 2-4 kinds, each with a "patch" that sets some of that thing's knobs. People decide intents; a model may believe things about them; code fills in the rest. Precedence: a person's decision > their preference > a model's belief when sure > code. You never override what a person decided.

You are shown: the entities (each thing on the stage, with its knobs: the value the scene wrote, unit, range, note), the intent tree, the decisions people made, the event (a drag on the stage, or a prompt about one entity), and earlier prompts (context).

Answer with ONE action as a single JSON object, nothing else:
- {"action":"decide","key":"<type>|<of>","kind":"<kind>","why":"..."}  the event means an existing intent's existing kind.
- {"action":"add","node":{"type":"<short-name>","of":"<entity id or id#member>","words":{"en":"...","zh":"..."},"kinds":{"asWritten":{"words":{"en":"As written","zh":"原样"},"patch":{"<entity>":{"<knob>":<the value the scene wrote>}}},"<other>":{"words":{...},"patch":{"<entity>":{"<knob>":<value in range>}}}},"resolve":"switch"},"kind":"<the kind the person means>","why":"..."}  no intent covers it, but the existing knobs can express it: a new intent whose first kind is the scene as written.
- {"action":"believe","beliefs":[{"key":"<type>|<of>","p":{"<kind>":0.7,"<kind>":0.3}}],"why":"..."}  a mood or a general wish: shift beliefs over several intents; decisions stay.
- {"action":"none","why":"..."}  nothing in the tree or the knobs can express it (say what would be needed).

Rules: "key" is copied exactly from the list of intents you are given (type|of, e.g. keep|moments#2); "kind" is one of that intent's kinds, or for "add" one of the new node's own kind names, never its type; only knobs listed on an entity, reading each knob's note for which way it goes; numbers within their range; every kind of a node sets the same knobs; names are short camelCase; keep "why" to one sentence.`;

export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: "too much to observe" }, { status: 413 });
  let observation: { event?: { kind?: string; text?: string }; tree?: { type: string; of: string; kinds: Record<string, unknown> }[] };
  try {
    observation = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "not JSON" }, { status: 400 });
  }
  if (observation.event?.kind === "prompt" && (observation.event.text ?? "").length > 500) {
    return NextResponse.json({ error: "a prompt that long is not one intent" }, { status: 413 });
  }
  const resolved = resolveModel();
  if (!resolved) return NextResponse.json({ error: "no model is configured" }, { status: 501 });
  try {
    const { text: out } = await generateText({
      model: resolved.model,
      system: SYSTEM,
      // The intents' keys and kinds spelled out, so a decision names them exactly.
      prompt: `Intents (key: kinds): ${(observation.tree ?? []).map((n) => `${n.type}|${n.of}: ${Object.keys(n.kinds ?? {}).join(", ")}`).join("; ")}\n\n${JSON.stringify(observation)}`,
      maxOutputTokens: 1200,
    });
    const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
    const answer = JSON.parse(json);
    return NextResponse.json({ answer, model: resolved.id });
  } catch (error) {
    return NextResponse.json({ error: `the model's answer could not be read: ${(error as Error).message.slice(0, 200)}`, model: resolved.id }, { status: 502 });
  }
}
