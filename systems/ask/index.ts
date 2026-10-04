// =============================================================================
// Ask: the command palette as a conversation with an agent that reads the
// site. See docs/system-ask.md.
// =============================================================================

import dynamic from "next/dynamic";

/** The chat, loaded the first time Ask opens (AI Elements, streamdown, the
 *  AI SDK client are none of the page's business until then). */
export const AskChat = dynamic(() => import("./components/chat"), { ssr: false });

// The pieces, for a surface of its own. Importing these is importing AI
// Elements and the AI SDK client: do it from a lazily loaded module.
// - ./components/messages   AskMessages: the conversation
// - ./components/composer   AskComposer: field, model, effort, voice, send
// - ./components/history    AskHistory: past conversations
// - ./lib/use-ask           useAskSession / useAskHistory / useAskPrefs / useAskRunning / useAskRequest
