"use client";

/**
 * TimelineEditContext — opt-in editing affordances for the shared timeline.
 *
 * The /works page renders the timeline with NO provider, so `useTimelineEdit()`
 * returns null and every component behaves exactly as the read-only public view.
 * The /editor preview wraps the same timeline in a provider, which switches on
 * in-canvas editing: rows become selectable (click to open the editor drawer),
 * tag ref markers become editable, and a per-tag "add commit" handle appears.
 *
 * Keeping this in context (rather than threading props through LogTimeline →
 * TagBlock → Commit → TimelineCommit) means the public render path is untouched
 * and the editor wiring stays in one place.
 */

import { createContext, useContext, type ReactNode } from "react";

export interface TimelineEditContextValue {
  /** Currently-selected commit id (its row is highlighted + expanded). */
  selectedCommitId: string | null;
  /** Currently-edited tag id (its ref marker is highlighted). */
  editingTagId: string | null;
  /** Open the editor drawer for a commit. */
  onEditCommit: (id: string) => void;
  /** Open the editor drawer for a tag. */
  onEditTag: (id: string) => void;
  /** Create a new commit under a tag and select it. */
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

/** Returns the edit context, or null on the read-only public timeline. */
export function useTimelineEdit(): TimelineEditContextValue | null {
  return useContext(TimelineEditContext);
}
