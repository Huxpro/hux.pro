// =============================================================================
// When the open conversation should give way to a new one.
//
// The hint is the page context (./page-context.ts). A question about this
// post, including one paragraph of it, is the same context, so the chat
// continues. Another post is a new context: opening Ask there, or asking
// about a paragraph of it, starts a new chat. The one left is in the history.
// =============================================================================

interface SubjectPart {
  type: string;
  data?: { doc?: string };
}

interface SubjectMessage {
  role: string;
  parts: readonly SubjectPart[];
}

/** A blog post's doc id, from its address. Anywhere else, nothing. */
export function postSubjectFromPath(pathname: string): string | null {
  const post = /^\/writing\/([^/]+)\/(en|zh)\/?$/.exec(pathname);
  if (!post) return null;
  return `post:${decodeURIComponent(post[1])}:${post[2]}`;
}

/** The doc a conversation is about: the latest context that names one.
 *  A follow-up that carries no context keeps the earlier doc. */
export function conversationSubject(messages: readonly SubjectMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    let doc: string | null = null;
    for (const part of messages[i].parts) {
      if (part.type === "data-context" && part.data?.doc) doc = part.data.doc;
    }
    if (doc) return doc;
  }
  return null;
}

/** The PL chart is one post. A language row open on it is that post, not a
 *  different page. */
function chartLang(doc: string): string | null {
  const language = /^language:[^:]+:(en|zh)$/.exec(doc);
  if (language) return language[1];
  const post = /^post:pl-chart:(en|zh)$/.exec(doc);
  return post?.[1] ?? null;
}

/** Same thing to ask about. A missing side keeps the chat: the home has no
 *  post to replace it with. */
export function sameAskContext(conversationDoc: string | null, pageDoc: string | null): boolean {
  if (!conversationDoc || !pageDoc) return true;
  if (conversationDoc === pageDoc) return true;
  const conversationChart = chartLang(conversationDoc);
  const pageChart = chartLang(pageDoc);
  return conversationChart !== null && conversationChart === pageChart;
}

export interface KeptChat {
  chatId: string;
  /** The post open when the reader chose this conversation. */
  subject: string | null;
}

/**
 * Start a new chat when the post open now is a different context from the
 * one this conversation is about. An empty conversation has nothing to
 * leave. A conversation the reader just picked from the history stays put
 * until the post changes again.
 */
export function shouldStartNewChat(
  messages: readonly SubjectMessage[],
  chatId: string,
  pageSubject: string | null,
  kept: KeptChat | null,
): boolean {
  if (!pageSubject) return false;
  if (kept?.chatId === chatId && kept.subject === pageSubject) return false;
  if (!messages.some((message) => message.role === "user")) return false;
  const subject = conversationSubject(messages);
  if (!subject) return false;
  return !sameAskContext(subject, pageSubject);
}
