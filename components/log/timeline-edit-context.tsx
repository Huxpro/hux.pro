"use client";

/**
 * TimelineEditContext — opt-in editing affordances for the shared timeline.
 *
 * The /works page renders the timeline with NO provider, so `useTimelineEdit()`
 * returns null and every component behaves exactly as the read-only public view.
 * The /editor preview wraps the same timeline in a provider, which carries a
 * formal interaction `mode`:
 *
 *   - "preview" — the canvas behaves byte-for-byte like the public site: hover
 *     preview cards, click-to-expand, links and media open normally. This lets
 *     the author *experience* the result.
 *   - "inspect" — the canvas becomes a Figma-style selection surface: hovering
 *     outlines the unit under the cursor, clicking selects it (commit row, tag
 *     ref marker, or an individual media item) and opens its editor in the
 *     docked Inspector. Links/media don't navigate; they select.
 *
 * Keeping this in context (rather than threading props through LogTimeline →
 * TagBlock → Commit → TimelineCommit → MediaRenderer) means the public render
 * path is untouched and the editor wiring stays in one place.
 */

import { createContext, useContext, type ReactNode } from "react";

export type InspectMode = "preview" | "inspect";

export interface TimelineEditContextValue {
  /** Global interaction mode. Only "inspect" turns on selection. */
  mode: InspectMode;
  /** Currently-selected commit id (its row is highlighted + expanded). */
  selectedCommitId: string | null;
  /** Currently-edited tag id (its ref marker is highlighted). */
  editingTagId: string | null;
  /** Index into the selected commit's `media` array, when a single media
   *  item is the focus of inspection. */
  selectedMediaIndex: number | null;
  /** Select a commit for inspection. */
  onSelectCommit: (id: string) => void;
  /** Select a tag for inspection. */
  onSelectTag: (id: string) => void;
  /** Select an individual media item within a commit. */
  onSelectMedia: (commitId: string, mediaIndex: number) => void;
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

/**
 * Convenience: true only when the editor is mounted AND in inspect mode.
 * In "preview" mode this is false, so the timeline falls back to its exact
 * public behavior.
 */
export function useIsInspecting(): boolean {
  return useContext(TimelineEditContext)?.mode === "inspect";
}
