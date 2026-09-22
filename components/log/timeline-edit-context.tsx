"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InspectMode = "preview" | "inspect";

export interface TimelineEditContextValue {
  mode: InspectMode;
  selectedCommitId: string | null;
  /** The presentation row under inspection, when the selection is a fold
   *  rather than one of its commits. */
  selectedPresentationId: string | null;
  editingTagId: string | null;
  selectedMediaIndex: number | null;
  onSelectCommit: (id: string) => void;
  onSelectPresentation: (id: string) => void;
  onSelectTag: (id: string) => void;
  onSelectMedia: (commitId: string, mediaIndex: number) => void;
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
