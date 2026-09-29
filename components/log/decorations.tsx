"use client";

/**
 * Decorations — the talks a project wears, as refs on its row.
 *
 *   a0ac582  ▣ Lynx Framework                              2023 – Present
 *              ◔ React Summit · GOSIM Paris 2026 · D2 2025 · WeAreDevelopers …
 *
 * `git log --decorate` prints a commit's refs beside its subject in
 * parentheses; this prints the talks that present a project under its
 * title, in the row's mono metadata voice, one mark per kind and the venue
 * for each (`computeDecorations`, lib/log.ts). Each venue is the talk: it
 * opens the talk's attachments through the same door its cover would (the
 * recording to the theater, the session page to a window, everything to
 * the sheet on a phone), peeks them under a pointer, and carries the talk's
 * hash as its id so `/works#<hash>` still lands — on the ref, with the
 * arrival wash, since the ref is where the talk now is.
 */

import { useMemo, type MouseEvent } from "react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import {
  computeCommitHash,
  localize,
  type Commit as CommitData,
  type CommitType,
} from "@/lib/log";
import { attachmentSetFor, useOptionalAttachments } from "@/systems/attachments";
import { useInputCapability } from "@/services";
import { buildCommitPreview } from "./commit-embed";
import { CommitIcon } from "./icons";

/** Where a talk or a piece of press happened — the ref's name. */
function venueOf(commit: CommitData): string | undefined {
  switch (commit.type) {
    case "talk":
      return commit.conference.name;
    case "post":
      return commit.publication.name;
    case "press":
      return commit.platform;
    default:
      return undefined;
  }
}

const ORDER: CommitType[] = ["talk", "post", "press"];

export function Decorations({
  commits,
  locale,
  className,
}: {
  commits: readonly CommitData[];
  locale: Locale;
  className?: string;
}) {
  // One line per kind, so a project's talks and its press do not share a
  // mark: each line opens with its kind's icon, the way the chips wear it.
  const groups = ORDER.map((type) => ({
    type,
    items: commits.filter((c) => c.type === type),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. A ref opens its talk; the
      // row's press is the title line's.
      data-row-body
      className={cn("space-y-0.5", className)}
    >
      {groups.map(({ type, items }) => (
        <p
          key={type}
          className={cn("flex flex-wrap items-baseline gap-x-1.5", TYPE.rowMeta)}
        >
          <CommitIcon
            type={type}
            className="h-3 w-3 shrink-0 self-center text-quaternary-foreground"
          />
          {items.map((c, i) => (
            <span key={c.id} className="inline-flex items-baseline gap-x-1.5">
              {i > 0 && (
                <span aria-hidden className="text-quaternary-foreground">
                  ·
                </span>
              )}
              <Ref
                commit={c}
                locale={locale}
                // Two talks at one conference would be one venue printed
                // twice, which names neither; those go by their titles.
                byTitle={items.some((o) => o !== c && venueOf(o) === venueOf(c))}
              />
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

function Ref({
  commit,
  locale,
  byTitle = false,
}: {
  commit: CommitData;
  locale: Locale;
  byTitle?: boolean;
}) {
  const attachments = useOptionalAttachments();
  const { magneticPreviewEnabled } = useInputCapability();
  const hash = computeCommitHash(commit.id);
  const title = localize(commit.title, locale);
  const venue = venueOf(commit);
  const name = byTitle || !venue ? title : venue;
  const set = useMemo(() => attachmentSetFor(commit, locale), [commit, locale]);
  const preview = useMemo(
    () => (magneticPreviewEnabled ? buildCommitPreview(commit, locale) : null),
    [commit, locale, magneticPreviewEnabled],
  );
  const href = set?.items[0]?.url;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!attachments || !set) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    attachments.open(set, 0);
  };

  // `id` + `data-rail-row` is what `useCommitAnchor` looks for, and the
  // inner `data-row-trigger` is where its arrival wash paints.
  const label = href ? (
    <a
      href={href}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="transition-colors hover:text-foreground"
    >
      {name}
    </a>
  ) : (
    <span title={title}>{name}</span>
  );

  return (
    <span id={hash} data-rail-row className="inline-flex max-w-full">
      <span data-row-trigger className="-mx-1 max-w-[18rem] truncate rounded px-1">
        <MagneticPreview
          preview={preview?.node}
          enabled={!!preview}
          panelClassName={preview?.panelClassName}
          as="span"
        >
          {label}
        </MagneticPreview>
      </span>
    </span>
  );
}
