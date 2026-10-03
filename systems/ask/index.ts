// =============================================================================
// Ask: the command palette as a conversation with an agent that reads the
// site. See docs/system-ask.md.
// =============================================================================

import dynamic from "next/dynamic";

/** The chat, loaded the first time Ask opens (AI Elements, streamdown, the
 *  AI SDK client are none of the page's business until then). */
export const AskChat = dynamic(() => import("./components/chat"), { ssr: false });

export type { AskChatProps } from "./components/chat";
export { isQuestionLike } from "./lib/intent";
