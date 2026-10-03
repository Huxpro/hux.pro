// =============================================================================
// Ask: a conversation with an agent that reads the site, in a panel that
// stays beside the page. See docs/system-ask.md.
// =============================================================================

/** The panel (a sheet on a phone), mounted once in the root layout. Its
 *  contents load the first time it opens. */
export { AskSurface } from "./surface";

export { isQuestionLike } from "./lib/intent";

// The pieces, for a surface of its own. Importing these is importing AI
// Elements and the AI SDK client: do it from a lazily loaded module.
// - ./components/messages   AskMessages: the conversation
// - ./components/composer   AskComposer: field, model, effort, voice, send
// - ./components/history    AskHistory: past conversations
// - ./components/panel      AskPanel: those three, as the panel shows them
// - ./lib/use-ask           useAskSession / useAskHistory / useAskPrefs / useAskRequest
