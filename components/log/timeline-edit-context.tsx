"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InspectMode = "preview" | "inspect";

/**
 * Sub-element inspect targets — the row parts that map 1:1 onto a form
 * field (or field group) in the inspector. Clicking one in the preview
 * selects the commit AND scrolls/flashes the corresponding form section,
 * Figma-style: the canvas element IS the entry point to its metadata.
 */
export type InspectField =
  | "title"
  | "description"
  | "date"
  | "meta"
  | "commentary"
  | "tags"
  | "stats"
  | "language"
  | "team"
  | "author";

export interface TimelineEditContextValue {
  mode: InspectMode;
  selectedCommitId: string | null;
  editingTagId: string | null;
  selectedMediaIndex: number | null;
  /** Form field the inspector should scroll to / highlight, if any. */
  selectedField: InspectField | null;
  /**
   * Inspect-mode global flag: render rows the public site hides
   * (hidden-role rows, unlisted / locale-scoped commits) as annotated
   * ghosts. Off = the canvas shows exactly what production shows.
   */
  showHidden: boolean;
  onSelectCommit: (id: string) => void;
  onSelectTag: (id: string) => void;
  onSelectMedia: (commitId: string, mediaIndex: number) => void;
  /** Select a commit and focus one of its form fields in the inspector. */
  onSelectField: (commitId: string, field: InspectField) => void;
  onAddCommit: (tagId: string) => void;
}

const TimelineEditContext = createContext<TimelineEditContextValue | null>(null);

export function TimelineEditProvider({
  value,
  children,
}: {
  value: TimelineEditContextValue;
  children: ReactNode;
}) {
  return (
    <TimelineEditContext.Provider value={value}>
      {children}
    </TimelineEditContext.Provider>
  );
}

export function useTimelineEdit(): TimelineEditContextValue | null {
  return useContext(TimelineEditContext);
}
