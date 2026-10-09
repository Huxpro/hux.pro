"use client";

import { CommitIcon } from "@/components/log/icons";
import { LOG } from "@/lib/log-client";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useOverAboutZ } from "@/systems/about/provider";
import { useOptionalAttachments } from "@/systems/attachments/provider";
import { Actions } from "@/systems/attachments/components/attachment-page";
import { attachmentSetFor } from "@/systems/attachments/lib/set";
import { ANCHORED_PRESENTATION, AdaptiveSurface, SURFACE_EASING } from "@/systems/surface";
import { CornerDownRight } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useLayoutEffect, useRef, useState } from "react";
import { useIdentityCard } from "../provider";
import type { IdentityProfile, ProfileCommit } from "../lib/profile";
import { IdentityProfileView, type ProfileFilter } from "./identity-profile";

// =============================================================================
// IdentityCard: a role, as a surface, for a press.
//
// A press on the mark opens it, whatever the input: on a phone the role
// comes up as a sheet; from `sm` up, as a popover hanging off the mark
// (`ANCHORED_PRESENTATION`). On a desktop the hover peek (identity-hover.tsx)
// comes first, as a glance, and points here for the rest. The header names the handle and nothing more,
// since a profile's name is its title.
//
// Where the peek only answers "who was I then?", the drawer is somewhere to
// go from: the profile, whose figures are the tabs of the signed commits
// under them (each a row that opens its attachments in their own drawer,
// stacked over this one the iOS way), and Visit, to the role's row on
// /works.
// =============================================================================

/**
 * A signed commit, as a row of the card's list: its type's glyph, the title,
 * the date on the right. The row is the button; the inset group it sits in
 * already says these are things to open, so it carries no chevron.
 */
function CommitRow({
  commit,
  onOpen,
}: {
  commit: ProfileCommit;
  onOpen: (commit: ProfileCommit) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(commit)}
      className={cn(
        "pressable flex w-full items-center gap-3 px-3 py-2.5 text-left",
        "transition-colors hover:bg-accent/40 active:bg-accent/60",
        "outline-none focus-visible:bg-accent/40",
      )}
    >
      <CommitIcon type={commit.type} className="h-3.5 w-3.5 shrink-0 text-tertiary-foreground" />
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>{commit.title}</span>
      <span className={cn("shrink-0 tabular-nums", TYPE.rowMeta)}>{commit.date}</span>
    </button>
  );
}

/**
 * A box whose height follows its content's on a curve. A tab changes how many
 * rows the list holds, and the sheet is as tall as what it holds
 * (`fitContent`), so without this the sheet jumped to its new height in one
 * frame. Animating the list's own box is enough: the sheet's height is
 * `auto`, so it follows the box frame by frame, growing and shrinking from
 * its top edge as a floating sheet does, and nothing in the sheet itself is
 * touched. The content changes at once; the box catches up, clipping it.
 */
function EasedHeight({ className, children }: { className?: string; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  // `undefined` until measured: the first height is the content's own, with
  // nothing to ease from.
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className={cn(
        "overflow-hidden transition-[height] duration-300 motion-reduce:transition-none",
        className,
      )}
      style={{ height, transitionTimingFunction: SURFACE_EASING }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/**
 * The profile with its list. Keyed by the identity and role it shows, so a
 * card opened on another handle starts back on All.
 */
function IdentityCardBody({
  profile,
  onOpen,
}: {
  profile: IdentityProfile;
  onOpen: (commit: ProfileCommit) => void;
}) {
  const [filter, setFilter] = useState<ProfileFilter>("all");
  const commits =
    filter === "all" ? profile.commits : profile.commits.filter((c) => c.type === filter);
  return (
    <IdentityProfileView
      profile={profile}
      filter={filter}
      onFilter={setFilter}
      contributions={
        <EasedHeight className="rounded-lg bg-muted/50">
          <div className="divide-y divide-border/40">
            {commits.map((c) => (
              <CommitRow key={c.id} commit={c} onOpen={onOpen} />
            ))}
          </div>
        </EasedHeight>
      }
    />
  );
}

export function IdentityCard() {
  const { locale } = useLocale();
  const { isOpen, close, profile, anchorRef } = useIdentityCard();
  const attachments = useOptionalAttachments();
  const router = useTransitionRouter();
  // Opened from the About's copy (a magic link naming a role), it floats
  // over the About rather than taking its place.
  const overAboutZ = useOverAboutZ();

  const go = (href: string) => {
    close();
    router.push(href);
  };

  // A commit with attachments opens them in the drawer, over this one, as
  // its /works cover would on a phone; anywhere the drawer is not the way
  // (or with nothing to open) the commit's row on /works is.
  const openCommit = (item: ProfileCommit) => {
    const commit = LOG.commits.find((c) => c.id === item.id);
    const set = commit && attachmentSetFor(commit, locale);
    if (set && attachments && attachments.homeOf(set, 0) === "surface") {
      attachments.open(set, 0);
      return;
    }
    go(item.href);
  };

  return (
    <AdaptiveSurface
      id="surface-identity"
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      presentation={ANCHORED_PRESENTATION}
      title={profile ? `<${profile.handle}>` : ""}
      closeLabel={t(locale, "identityCardClose")}
      popover={{ anchor: anchorRef, width: "min(92vw, 380px)" }}
      maxHeight="min(80dvh, 640px)"
      fitContent
      zIndex={overAboutZ}
    >
      {profile && (
        <div className="space-y-4 pt-1">
          <IdentityCardBody
            key={`${profile.id}:${profile.role.id}`}
            profile={profile}
            onOpen={openCommit}
          />

          <Actions
            primary={{
              label: t(locale, "logVisit"),
              icon: <CornerDownRight className="h-3.5 w-3.5" />,
              onSelect: () => go(profile.roleHref),
              href: profile.roleHref,
            }}
          />
        </div>
      )}
    </AdaptiveSurface>
  );
}
