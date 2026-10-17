// =============================================================================
// A library on the core: how a running host lays itself open to an inspector
// in another frame (the Lab's /lab/reintent). The host sets
// `window.__reintent`; the inspector reads it off the frame (same origin) and
// drives the loop through it. Like React DevTools' hook, but it may also
// dispatch: an inspector is where a person decides.
// =============================================================================

import type { Program } from "./program";
import type { Root } from "./root";
import type { Reading, Recognized } from "./words";

export interface ProgramVersion {
  id: string;
  /** What this version is, in a line. */
  note: string;
  program: Program;
  /** Its source, as written (TSX): what a model reads and rewrites. */
  source: string;
}

/** What a sentence came to: its reading, and what was done about it. */
export type Said = Recognized & { done: string };

export interface ReintentDevtools {
  root: Root;
  /** The program's versions, the running one among them. */
  versions: readonly ProgramVersion[];
  current(): string;
  /** Run another version of the program under the same doc (reconciled). */
  use(id: string): void;
  /** A sentence, read and acted on: resolved, asked, handed to a model, or said of the whole. */
  say(text: string): Said;
  /** An answer to a question `say` (or the doc) raised. */
  answer(reading: Reading): void;
  /** The state as a model is shown it. */
  observe(): string;
}

declare global {
  interface Window {
    __reintent?: ReintentDevtools;
  }
}

export function expose(devtools: ReintentDevtools) {
  window.__reintent = devtools;
}
