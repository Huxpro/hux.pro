// =============================================================================
// Ask: a page of its own (/ask), a conversation with an agent that reads the
// site. See docs/system-ask.md.
// =============================================================================

import dynamic from "next/dynamic";

/** The page's app, loaded when /ask opens (AI Elements, streamdown, the AI
 *  SDK client are no other page's business). */
export const AskPage = dynamic(() => import("./components/page"), { ssr: false });

export type { AskPageProps } from "./components/page";
export { isQuestionLike } from "./lib/intent";

// The pieces, for a surface of its own. Importing these is importing AI
// Elements and the AI SDK client: do it from a lazily loaded module.
// - ./components/messages   AskMessages: the conversation
// - ./components/composer   AskComposer: field, model, effort, voice, send
// - ./components/history    AskHistory: past conversations
// - ./lib/use-ask           useAskSession / useAskHistory / useAskPrefs / useAskRequest
