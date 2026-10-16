// =============================================================================
// intents: a model-and-person collaboration loop over Reintent.
// See docs/system-intents.md.
//
// A strong model, making an artifact, writes its intent tree with it. After
// that, everything is a shortcut through the tree: code computes from it
// (reintent, the host's realize), a person resolves (a pick, an answer, a drag
// onto a kind), and a model infers again (routed weak or strong) when no
// preset reads what happened. The tree is the state; it is saved, shared and
// remixed as versions.
// =============================================================================

export * from "./tree";
export { values, realized, space, type Value, type Source } from "./space";
export { recognize, gestureFor, dragValue, DOCK, SNAP, type Event, type Need, type Reading, type Recognized } from "./recognize";
export { infer, draw, observe, tierOf, applyAnswer, toRealize, fromRealize, type Answer, type AnswerKind, type AnswerNode, type AnswerIntent, type Host, type Inference, type Tier } from "./router";
export { encodeVersion, decodeVersion, versionInHash, savedUrl, newId, type Saved } from "./version";
export { sanitizeSvg } from "./sanitize";
export { useIntents, overlay, type IntentsApi, type Snapshot, type LogEntry, type Ask, type DragPreview, type Path } from "./runtime";
