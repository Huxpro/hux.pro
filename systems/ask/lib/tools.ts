import { jsonSchema, tool, type InferUITools, type UIMessage } from "ai";
import { ASK_TOOLS } from "../prompts";
import type { AskDoc } from "./corpus";

// =============================================================================
// The agent's tools: declared here, run in the browser. What the model reads
// about them (descriptions, parameters) is ../prompts.ts.
//
// The chat route (app/api/chat) hands these to the model without an
// `execute`, so a call the model makes comes back to the page, which runs it
// against the index it has loaded (./search.ts) and answers with the result.
// The route decides which tools exist and what they take; the page only
// decides how they run. Tools that act on the site (navigate, open a post)
// will join them here.
// =============================================================================

export interface SearchInput {
  query: string;
  lang?: "en" | "zh" | "any";
  limit?: number;
}

export interface ReadInput {
  id: string;
}

/** A passage `search_site` found. */
export interface SearchHit {
  /** Passage id, for `read`. */
  id: string;
  doc: string;
  kind: AskDoc["kind"];
  lang: AskDoc["lang"];
  title: string;
  heading?: string;
  href: string;
  snippet: string;
}

/** What `read` returns: the doc or passage, or why there is none. */
export type ReadOutput =
  | {
      id: string;
      /** The doc it is, or is a passage of. */
      doc: string;
      title: string;
      href: string;
      lang: AskDoc["lang"];
      summary?: string;
      date?: string;
      text: string;
      /** More text exists than was returned. */
      truncated?: boolean;
    }
  | { error: string };

export interface PresentInput {
  /** Doc ids (a passage id stands for its doc). */
  ids: string[];
}

/** What `present` returns: the docs now shown as cards, or why none. */
export type PresentOutput = { shown: string[] } | { error: string };

export interface OpenPageInput {
  /** A path on this site, `#` part included (from the tools or the map). */
  href: string;
  /** Words from the page to scroll to and highlight (a sentence from a
   *  passage it read). */
  quote?: string;
}

export type OpenPageOutput = { opened: string; highlighted?: boolean } | { error: string };

export interface PlayInput {
  /** A work's doc id (a talk, a project). */
  id: string;
  /** What to open of it; the recording first when unsaid. */
  kind?: "video" | "slides" | "image" | "link";
}

export type PlayOutput = { playing: string; kind: string } | { error: string };

export const askTools = {
  search_site: tool({
    description: ASK_TOOLS.search_site.description,
    inputSchema: jsonSchema<SearchInput>({
      type: "object",
      properties: {
        query: { type: "string", description: ASK_TOOLS.search_site.params.query },
        lang: {
          type: "string",
          enum: ["en", "zh", "any"],
          description: ASK_TOOLS.search_site.params.lang,
        },
        limit: { type: "number", description: ASK_TOOLS.search_site.params.limit },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    // Described for the types; the page produces it (systems/ask/lib/search).
    outputSchema: jsonSchema<SearchHit[]>({ type: "array" }),
  }),
  read: tool({
    description: ASK_TOOLS.read.description,
    inputSchema: jsonSchema<ReadInput>({
      type: "object",
      properties: {
        id: { type: "string", description: ASK_TOOLS.read.params.id },
      },
      required: ["id"],
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<ReadOutput>({ type: "object" }),
  }),
  present: tool({
    description: ASK_TOOLS.present.description,
    inputSchema: jsonSchema<PresentInput>({
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6,
          description: ASK_TOOLS.present.params.ids,
        },
      },
      required: ["ids"],
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<PresentOutput>({ type: "object" }),
  }),
  open_page: tool({
    description: ASK_TOOLS.open_page.description,
    inputSchema: jsonSchema<OpenPageInput>({
      type: "object",
      properties: {
        href: { type: "string", description: ASK_TOOLS.open_page.params.href },
        quote: { type: "string", description: ASK_TOOLS.open_page.params.quote },
      },
      required: ["href"],
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<OpenPageOutput>({ type: "object" }),
  }),
  play: tool({
    description: ASK_TOOLS.play.description,
    inputSchema: jsonSchema<PlayInput>({
      type: "object",
      properties: {
        id: { type: "string", description: ASK_TOOLS.play.params.id },
        kind: {
          type: "string",
          enum: ["video", "slides", "image", "link"],
          description: ASK_TOOLS.play.params.kind,
        },
      },
      required: ["id"],
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<PlayOutput>({ type: "object" }),
  }),
};

/**
 * What the reader has open, sent with a question (a `data-context` part of
 * the user's message): the page and the part of it in view, or something
 * they pointed at. The route hands it to the model as text (ASK_CONTEXT in
 * ../prompts.ts); the message shows it as a tag.
 */
export interface AskContext {
  /** page: the page they are on (the section in view, the entry open);
   *  quote: words they selected; item: a thing they dragged in. */
  kind: "page" | "quote" | "item";
  /** The doc it is, when the site's index has it. */
  doc?: string;
  title: string;
  href: string;
  /** The heading of the section in view. */
  heading?: string;
  /** The text in question: the section, the entry, the selection. */
  text?: string;
}

export type AskDataTypes = { context: AskContext };

export type AskUIMessage = UIMessage<unknown, AskDataTypes, InferUITools<typeof askTools>>;

/** The contexts a message was sent with. */
export function contextsOf(message: AskUIMessage): AskContext[] {
  return message.parts.flatMap((p) => (p.type === "data-context" ? [p.data] : []));
}

/** What a message says, as Markdown: what Copy copies. */
export function textOf(message: AskUIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? p.text.trim() : ""))
    .filter(Boolean)
    .join("\n\n");
}
