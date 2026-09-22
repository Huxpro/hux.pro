"use client";

/**
 * One works-page row for a presentation.
 *
 * The header is a commit row — the same TimelineCommit every other line
 * uses — wearing the anchor's date, type and hash-column address. The
 * body is the members. Their media is the row's media, by reference, so a
 * cover still opens the attachment it always opened. The commits themselves
 * are not involved: this file only reads a ResolvedPresentation.
 */

import { useMemo } from "react";
import type { Locale } from "@/lib/i18n";
import type { Commit, Media } from "@/lib/log";
import {
  computeCommitHash,
  formatCommitDate,
  getCommitLanguageBadge,
  getMediaStripItems,
  isLinkPill,
  isPinnedMedia,
} from "@/lib/log";
import type { AttachmentSet } from "@/systems/attachments";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { Byline } from "./bylines";
import { extractMediaLinks, type NormalizedCommit } from "./commit-data";
import type { ResolvedChild, ResolvedLeaf, ResolvedPresentation } from "@/lib/presentation";
import { TimelineCommit, type BeamSpec } from "./timeline-commit";
import { useTimelineEdit } from "./timeline-edit-context";
import type { LogForm } from "@/lib/log-view";
import { DEFAULT_FORM } from "@/lib/log-view";

function venueOf(commit: Commit): string | null {
  switch (commit.type) {
    case "talk":
      return commit.conference.name || null;
    case "press":
      return commit.platform || null;
    case "post":
      return commit.publication.name || null;
    default:
      return null;
  }
}

function toNormalized(
  presentation: ResolvedPresentation,
  locale: Locale,
): NormalizedCommit {
  const { anchor, leaves } = presentation;
  const media = leaves.flatMap((c) => c.media ?? []);
  const links = extractMediaLinks(media, locale);
  const rich = media.filter((m) => !isLinkPill(m));
  const pinned = rich.filter((m) => isPinnedMedia(m));
  const expanded = rich.filter((m) => !isPinnedMedia(m));
  const badges = new Set(
    leaves.map((c) => getCommitLanguageBadge(c, locale)),
  );
  const languageBadge =
    badges.size === 1 ? [...badges][0] : null;
  const venues = leaves.map(venueOf);
  const shared =
    venues.length > 1 && venues.every((v) => v && v === venues[0])
      ? venues[0]
      : null;
  const allAside = leaves.every((c) => c.present === "aside");

  return {
    hash: computeCommitHash(`presentation:${presentation.id}`),
    type: anchor.type,
    iconOverride: anchor.icon,
    present: allAside ? "aside" : undefined,
    title: presentation.title,
    description: presentation.description ?? "",
    date: formatCommitDate(anchor, locale),
    languageBadge,
    meta: shared && shared !== presentation.title ? shared : undefined,
    commentary: undefined,
    links,
    expandedMedia: expanded,
    pinnedMedia: pinned,
    stripItems: getMediaStripItems(expanded, locale),
  };
}

function attachmentSetForPresentation(
  presentation: ResolvedPresentation,
): AttachmentSet | null {
  const items = presentation.leaves.flatMap((c) =>
    (c.media ?? []).filter((m) => !isLinkPill(m)),
  );
  if (items.length === 0) return null;
  return {
    id: presentation.id,
    title: presentation.title,
    href: `/works#${computeCommitHash(`presentation:${presentation.id}`)}`,
    items,
  };
}

function directLines(children: ResolvedChild[]): string[] {
  return children.map((child) =>
    child.kind === "leaf" ? child.leaf.line : child.group.line,
  );
}


function LeafBlock({
  leaf,
  onOpen,
}: {
  leaf: ResolvedLeaf;
  onOpen?: (commitId: string) => void;
}) {
  const title = onOpen ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(leaf.commit.id);
      }}
      className="text-left hover:text-foreground transition-colors"
    >
      {leaf.line}
    </button>
  ) : (
    leaf.line
  );

  return (
    <div className="min-w-0">
      <div className={TYPE.rowTitle}>{title}</div>
      {leaf.title && (
        <div className={cn("mt-0.5", TYPE.rowMeta)}>{leaf.title}</div>
      )}
      {leaf.description && (
        <p className={cn("mt-1", TYPE.captionQuiet)}>{leaf.description}</p>
      )}
    </div>
  );
}

function Tree({
  nodes,
  depth,
  onOpen,
}: {
  nodes: ResolvedChild[];
  depth: number;
  onOpen?: (commitId: string) => void;
}) {
  return (
    <div className={cn("space-y-3", depth > 0 && "pl-3")}>
      {nodes.map((child) =>
        child.kind === "leaf" ? (
          <LeafBlock
            key={child.leaf.commit.id}
            leaf={child.leaf}
            onOpen={onOpen}
          />
        ) : (
          <div key={child.group.id} className="min-w-0">
            <div className={TYPE.rowTitle}>{child.group.line}</div>
            {child.group.description && (
              <p className={cn("mt-1", TYPE.captionQuiet)}>
                {child.group.description}
              </p>
            )}
            <div className="mt-2">
              <Tree
                nodes={child.group.children}
                depth={depth + 1}
                onOpen={onOpen}
              />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

interface PresentationRowProps {
  presentation: ResolvedPresentation;
  locale: Locale;
  className?: string;
  hideDate?: boolean;
  rail?: string;
  segmentId?: string | null;
  isSegmentActive?: boolean;
  beamSpec?: BeamSpec | null;
  onBeamSet?: (spec: BeamSpec) => void;
  onBeamClear?: (spec: BeamSpec) => void;
  byline?: Byline | null;
  form?: LogForm;
  onSelectHash?: (hash: string) => void;
}

export function PresentationRow({
  presentation,
  locale,
  className,
  hideDate,
  rail,
  segmentId,
  isSegmentActive,
  beamSpec,
  onBeamSet,
  onBeamClear,
  byline,
  form = DEFAULT_FORM,
  onSelectHash,
}: PresentationRowProps) {
  const edit = useTimelineEdit();
  const inspecting = edit?.mode === "inspect";
  const isSelected = edit?.selectedPresentationId === presentation.id;
  const data = useMemo(
    () => toNormalized(presentation, locale),
    [presentation, locale],
  );
  const set = useMemo(
    () => (inspecting ? null : attachmentSetForPresentation(presentation)),
    [presentation, inspecting],
  );

  const onInspectMedia =
    inspecting && edit
      ? (media: Media) => {
          for (const leaf of presentation.leaves) {
            const index = leaf.media?.indexOf(media) ?? -1;
            if (index >= 0) {
              edit.onSelectMedia(leaf.id, index);
              return;
            }
          }
        }
      : undefined;

  const roster = (open: boolean) => {
    if (open) {
      return (
        <Tree
          nodes={presentation.children}
          depth={0}
          onOpen={
            inspecting && edit
              ? (id) => edit.onSelectCommit(id)
              : undefined
          }
        />
      );
    }
    if (presentation.rosterIsBlurb) {
      const lines = directLines(presentation.children);
      if (lines.length === 0) return null;
      return (
        <div className={cn(TYPE.captionQuiet, "line-clamp-2")}>
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      );
    }
    const extras = directLines(presentation.children).filter(
      (line) => line !== presentation.title,
    );
    if (extras.length === 0) return null;
    return (
      <div className={cn(TYPE.rowMeta, "line-clamp-2")}>
        {extras.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    );
  };

  return (
    <TimelineCommit
      data={data}
      className={className}
      hideDate={hideDate}
      rail={rail}
      segmentId={segmentId}
      isSegmentActive={isSegmentActive}
      beamSpec={beamSpec}
      onBeamSet={onBeamSet}
      onBeamClear={onBeamClear}
      byline={byline}
      form={form}
      onSelectHash={onSelectHash}
      attachmentSet={set}
      inspecting={inspecting}
      isSelected={isSelected}
      onInspectCommit={
        inspecting && edit
          ? () => edit.onSelectPresentation(presentation.id)
          : undefined
      }
      onInspectMedia={onInspectMedia}
      roster={roster}
      memberHashes={presentation.leaves.map((c) => computeCommitHash(c.id))}
    />
  );
}
