// =============================================================================
// Reintent core: intents as a reactive, typed program. No host, no React, no
// model: those are on top (./react, ./words, ./observe, and each host's own).
//
//   intent()          a sum type of kinds, with their words and data
//   <Scene>/<Thing>/<Intent>   the program, in TSX, evaluated to data
//   values()          the one rule: person > rule > author > derived >
//                     viewer > model > code (or ask)
//   narrow / believe / learn   the writers of the doc
//   reconcile         the program rewritten: decisions kept by path
//   effect()          eager code, lazy model, cached under kinds
//   createRoot()      the loop: actions in, snapshots out, undo, preview
//
// docs/system-reintent-core.md has the model, and how it maps to React.
// =============================================================================

export { intent, argmax, margin, normalize, type Dist, type Kind, type KindSpec, type IntentType, type KindOf, type DataOf } from "./intent";
export { Scene, Thing, Intent, toProgram, check, cells, cellOf, nameOf, type Program, type ThingDecl, type IntentDecl, type IntentProps, type Cell, type Key, type Read, type Decl } from "./program";
export {
  EMPTY_DOC,
  narrow,
  believe,
  learn,
  reconcile,
  kindsOf,
  kindOf,
  contextKey,
  type Doc,
  type Decision,
  type Belief,
  type Pick,
  type Context,
  type Reconciled,
} from "./doc";
export { values, questions, staleCells, TAU, LEAN_WEIGHT, type Value, type Source } from "./decide";
export { effect, type Effect, type Written, type Under } from "./effect";
export { createRoot, apply, type Root, type Action, type Snapshot, type State, type LogEntry } from "./root";
