import { askSystemPrompt } from "@/lib/ask-prompt";
import { askModelOf, type AskModel } from "@/systems/ask/lib/models";
import { askTools, type AskUIMessage } from "@/systems/ask/lib/tools";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  gateway,
  streamText,
  toUIMessageStream,
  type LanguageModel,
} from "ai";

// =============================================================================
// Ask's one server route: holds the key, pins what the model is given, and
// streams the answer back as AI SDK UI messages.
//
// Thin on purpose. The system prompt, the tools, the model list and the
// output cap are fixed here; a request only carries the conversation and a
// model id from the list. The tools have no `execute`: the page runs them
// (systems/ask), so this route never touches the index.
//
// Which provider runs a model, first match wins:
//   AI_GATEWAY_API_KEY (or Vercel's OIDC token)  any model, via the gateway
//   ANTHROPIC_API_KEY / OPENAI_API_KEY           that provider's models
//   neither                                      a scripted stand-in that
//                                                exercises the tool loop
// =============================================================================

export const maxDuration = 60;

/** Turns kept from the conversation, and characters per user turn. */
const MAX_MESSAGES = 24;
const MAX_USER_CHARS = 4000;
const MAX_OUTPUT_TOKENS = 4000;

function resolveModel(model: AskModel): LanguageModel | null {
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) {
    return gateway(model.id);
  }
  const provider = model.id.split("/")[0];
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return createAnthropic()(model.direct);
  }
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return createOpenAI()(model.direct);
  }
  return null;
}

/** Only what the UI sends, trimmed to the limits above. */
function sanitize(messages: unknown): AskUIMessage[] | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const kept = (messages as AskUIMessage[])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && Array.isArray(m.parts))
    .slice(-MAX_MESSAGES);
  for (const m of kept) {
    if (m.role !== "user") continue;
    const chars = m.parts.reduce((n, p) => n + (p.type === "text" ? p.text.length : 0), 0);
    if (chars > MAX_USER_CHARS) return null;
  }
  return kept[0]?.role === "user" ? kept : kept.slice(kept.findIndex((m) => m.role === "user"));
}

export async function POST(req: Request) {
  let body: { messages?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const messages = sanitize(body.messages);
  if (!messages?.length) return new Response("Bad request", { status: 400 });

  const model = askModelOf(body.model);
  const languageModel = resolveModel(model);
  if (!languageModel) return standIn(messages);

  const result = streamText({
    model: languageModel,
    instructions: {
      role: "system",
      content: askSystemPrompt(),
      // The prompt is the same bytes on every request (the map of the site
      // is most of it): a cache breakpoint lets Anthropic serve it from
      // cache. Other providers cache prefixes on their own or ignore this.
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    },
    messages: await convertToModelMessages(messages, { tools: askTools }),
    tools: askTools,
    reasoning: "low",
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: askTools,
      sendReasoning: true,
      originalMessages: messages,
      onError: (error) => {
        console.error("[ask]", error);
        return "The model could not answer just now.";
      },
    }),
  });
}

// -----------------------------------------------------------------------------
// The stand-in: no key configured (a fresh checkout, a preview without
// secrets). It plays one round of the real loop, so the page can be built and
// tested without a model: the first turn asks the page to search for what was
// typed; once the result is back, it answers with the titles it found.
// -----------------------------------------------------------------------------

function standIn(messages: AskUIMessage[]) {
  const last = messages[messages.length - 1];
  const toolPart = last.role === "assistant"
    ? last.parts.findLast((p) => p.type === "tool-search_site")
    : undefined;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream<AskUIMessage>({
      originalMessages: messages,
      execute({ writer }) {
        writer.write({ type: "start" });
        writer.write({ type: "start-step" });
        if (!toolPart) {
          const asked = last.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join(" ")
            .trim();
          writer.write({ type: "reasoning-start", id: "r" });
          writer.write({
            type: "reasoning-delta",
            id: "r",
            delta: "No model is configured, so this is the stand-in. Searching the site for the question as typed.",
          });
          writer.write({ type: "reasoning-end", id: "r" });
          writer.write({
            type: "tool-input-available",
            toolCallId: `stand-in-${Date.now()}`,
            toolName: "search_site",
            input: { query: asked, limit: 5 },
          });
        } else {
          const output =
            toolPart.state === "output-available"
              ? (toolPart.output as { title: string; href: string }[])
              : [];
          const pages = [...new Map(output.map((h) => [h.href, h.title])).entries()];
          const lines = pages.length
            ? pages.map(([href, title]) => `- [${title}](${href})`).join("\n")
            : "Nothing on the site matched.";
          const text = `No model is configured (set \`AI_GATEWAY_API_KEY\` or \`ANTHROPIC_API_KEY\`), so this is the stand-in. The search ran in your browser and found:\n\n${lines}`;
          writer.write({ type: "text-start", id: "t" });
          writer.write({ type: "text-delta", id: "t", delta: text });
          writer.write({ type: "text-end", id: "t" });
        }
        writer.write({ type: "finish-step" });
        writer.write({ type: "finish" });
      },
    }),
  });
}
