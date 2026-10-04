import { jsonSchema, tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
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
};

export type AskToolName = keyof typeof askTools;

export type AskUIMessage = UIMessage<unknown, UIDataTypes, InferUITools<typeof askTools>>;
