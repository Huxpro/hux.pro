import { jsonSchema, tool, type InferUITools, type UIDataTypes, type UIMessage } from "ai";
import type { AskDoc } from "./corpus";

// =============================================================================
// The agent's tools: declared here, run in the browser.
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
    description:
      "Full-text search over everything on hux.pro: posts, the convictions and influences on /prompt, talks and projects on /works, the programming-languages chart. Returns passages with their doc id, title, heading, link and a snippet. Search in both languages when a topic may be written about in either (e.g. 'PWA' and '渐进式').",
    inputSchema: jsonSchema<SearchInput>({
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, not a sentence." },
        lang: {
          type: "string",
          enum: ["en", "zh", "any"],
          description: "Only passages in this language. Default any.",
        },
        limit: { type: "number", description: "Passages to return, 1 to 10. Default 6." },
      },
      required: ["query"],
      additionalProperties: false,
    }),
    // Described for the types; the page produces it (systems/ask/lib/search).
    outputSchema: jsonSchema<SearchHit[]>({ type: "array" }),
  }),
  read: tool({
    description:
      "Read a doc in full (a doc id such as `post:pl-chart:en`) or one passage (a passage id such as `post:pl-chart:en#3`). Use after search_site when a snippet is not enough to answer.",
    inputSchema: jsonSchema<ReadInput>({
      type: "object",
      properties: {
        id: { type: "string", description: "A doc id or passage id from search_site." },
      },
      required: ["id"],
      additionalProperties: false,
    }),
    outputSchema: jsonSchema<ReadOutput>({ type: "object" }),
  }),
};

export type AskToolName = keyof typeof askTools;

export type AskUIMessage = UIMessage<unknown, UIDataTypes, InferUITools<typeof askTools>>;
