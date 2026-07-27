// The /editor hub — each entry is an editor for one source of truth that the
// site materializes as a file on disk. Adding an editor here adds it to the
// switcher dropdown in every editor's toolbar.
export interface EditorEntry {
  id: string;
  /** The source-of-truth file this editor edits, shown as the editor's identity. */
  file: string;
  href: string;
  /** One-line description for the switcher menu. */
  blurb: string;
}

export const EDITORS: EditorEntry[] = [
  {
    id: "log",
    file: "log.json",
    href: "/editor",
    blurb: "Work history — the git-log timeline",
  },
  {
    id: "icon",
    file: "icon.json",
    href: "/editor/icon",
    blurb: "The λ wordmark & app icon",
  },
  {
    id: "surface",
    file: "surface.ts",
    href: "/editor/surface",
    blurb: "Surface Physics — the glass design language",
  },
];
