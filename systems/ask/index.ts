// =============================================================================
// Ask: a conversation with an agent that reads the site, kept in the Dock as
// a Live Activity. See docs/system-ask.md.
// =============================================================================

/** The Live Activity, for the Dock (app/layout.tsx). Loads lazily. */
export { AskActivity } from "./dock";

export { isQuestionLike } from "./lib/intent";

// The pieces, for a surface of its own. Importing these is importing AI
// Elements and the AI SDK client: do it from a lazily loaded module.
// - ./components/messages   AskMessages: the conversation
// - ./components/composer   AskComposer: field, model, effort, voice, send
// - ./components/history    AskHistory: past conversations
// - ./components/activity   the Dock's activity, built from those three
// - ./lib/use-ask           useAskSession / useAskHistory / useAskPrefs / useAskRequest
