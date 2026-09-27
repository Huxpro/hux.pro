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
import { ANCHORED_PRESENTATION, AdaptiveSurface } from "@/systems/surface";
import { ChevronRight, CornerDownRight } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useIdentityCard } from "../provider";
import type { ProfileCommit } from "../lib/profile";
import { IdentityProfileView } from "./identity-profile";

// =============================================================================
// IdentityCard — a role, as a surface, for a finger.
//
// On a desktop the profile is a hover peek off the handle (identity-hover.tsx)
// and this never opens. On a phone the same mark is tapped and the role comes
// up as a sheet; on a touch tablet, as a popover hanging off the mark
// (`ANCHORED_PRESENTATION`). The header names the handle, nothing more — a
// profile's name is its title.
//
// Where the peek only answers "who was I then?", the drawer is somewhere to
// go from: the profile, whose count of signed commits heads the commits
// themselves — each a row that opens its attachments in their own drawer,
// stacked over this one the iOS way — and Visit, to the role's row on
// /works.
// =============================================================================

/**
 * A signed commit, as a line of the card: the same lead as a role line (its
 * type's glyph in the small ring, identity-profile.tsx), so the card's
 * items hang from one column; the title, the date on the right, a chevron
 * for somewhere to go.
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
        "pressable -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-lg px-2 py-1.5 text-left",
        "transition-colors hover:bg-accent/40 active:bg-accent/60",
        "outline-none focus-visible:bg-accent/40",
      )}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-border/50">
        <CommitIcon type={commit.type} className="h-3 w-3 text-tertiary-foreground" />
      </span>
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>{commit.title}</span>
      <span className={cn("shrink-0 tabular-nums", TYPE.rowMeta)}>{commit.date}</span>
      <ChevronRight className="-mr-0.5 h-3.5 w-3.5 shrink-0 text-quaternary-foreground" />
    </button>
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
          <IdentityProfileView
            profile={profile}
            contributions={profile.commits.map((c) => (
              <CommitRow key={c.id} commit={c} onOpen={openCommit} />
            ))}
          />

          <Actions
            primary={{
              label: t(locale, "logVisit"),
              icon: <CornerDownRight className="h-3.5 w-3.5" />,
              onSelect: () => go(profile.roleHref),
            }}
          />
        </div>
      )}
    </AdaptiveSurface>
  );
}
