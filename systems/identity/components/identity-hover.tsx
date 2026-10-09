"use client";

import {
  MagneticPreview,
  PEEK_W,
} from "@/components/motion-primitives/magnetic-preview";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { MousePointerClick } from "lucide-react";
import type { ReactNode } from "react";
import { useIdentityProfile, useOptionalIdentityCard } from "../provider";
import { IdentityProfileView } from "./identity-profile";

// =============================================================================
// IdentityHover: the profile behind a handle, the way the row peeks.
//
// /works already has one hover system: the magnetic peek that follows the
// cursor off a folded row and shows what the row is holding. A handle, a
// `Role:` field and a role row are the same kind of thing (a name that
// stands for more than it prints), so they peek the same way: the card
// arrives with the pointer and leaves with it.
//
// The peek is a glance, and a glance cannot be pressed: it rides the cursor,
// so the pointer can never reach it. What the card holds beyond the glance
// (the signed commits, Visit) is one click away instead. The mark is a
// button everywhere, and a press opens the identity card (identity-card.tsx):
// a popover off the mark with a pointer, a sheet under a finger. The peek
// says so in its last line, and stands down while the card is open, so the
// two never stack.
// =============================================================================

/** The panel a profile peek arrives in: a visible card, so it lifts. */
export const IDENTITY_PEEK_PANEL = cn(PEEK_W, "p-4 shadow-raised");

/** The peek's contents. Mounted only while hovered, so the profile is
 *  derived for the one identity being looked at. */
export function IdentityPeek({
  identityId,
  roleId,
  openHint = false,
}: {
  identityId: string;
  roleId?: string;
  /**
   * Print "click to open the card" under the profile. Only where a press on
   * the mark does that (IdentityHover); a role row's press unfolds the row
   * and a magic link's goes to the role's row on /works, so their peeks keep
   * quiet rather than promise something the click will not do.
   */
  openHint?: boolean;
}) {
  const { locale } = useLocale();
  const profile = useIdentityProfile(identityId, roleId);
  if (!profile) return null;
  return (
    <>
      <IdentityProfileView profile={profile} />
      {/* The way past the glance, as the PL chart's peek says it. */}
      {openHint && (
        <p
          className={cn(
            TYPE.labelSm,
            "mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-muted-foreground",
          )}
        >
          <MousePointerClick aria-hidden className="size-3" />
          {t(locale, "identityPeekOpen")}
        </p>
      )}
    </>
  );
}

interface IdentityHoverProps {
  identityId: string;
  roleId?: string;
  /** Classes for the mark itself (the text). */
  className?: string;
  /** Classes for the wrapper the peek attaches to, e.g. a flex item's `shrink-0`. */
  wrapperClassName?: string;
  /**
   * The mark is a region, not a run of text: the author block, whose
   * `Author:` and `Role:` lines stand for the one identity together. The
   * whole area lights on hover, and under the finger that opens the sheet,
   * as a wash over the block. Colouring one line of it would say the
   * lines were separate things. The region's own layout (a subgrid of the
   * field stack it sits in) is the caller's, passed in `className` and
   * `wrapperClassName`; this only lights it.
   */
  block?: boolean;
  children: ReactNode;
}

/** The region's highlight: a wash over the whole block, hover and press alike. */
const BLOCK_HIGHLIGHT = cn(
  "-mx-2 -my-1 rounded-md px-2 py-1",
  "transition-colors duration-150 hover:bg-accent/40 active:bg-accent/60",
);

export function IdentityHover({
  identityId,
  roleId,
  className,
  wrapperClassName,
  block = false,
  children,
}: IdentityHoverProps) {
  const card = useOptionalIdentityCard();

  if (!card) {
    return block ? (
      <div className={className}>{children}</div>
    ) : (
      <span className={className}>{children}</span>
    );
  }

  return (
    <MagneticPreview
      // The card, once open, is the peek's longer form; both at once would
      // be one profile printed twice.
      enabled={!card.isOpen}
      preview={
        <IdentityPeek identityId={identityId} roleId={roleId} openHint />
      }
      panelClassName={IDENTITY_PEEK_PANEL}
      className={cn(
        !block && "inline-block max-w-full align-baseline",
        wrapperClassName,
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          card.open({ identityId, roleId, anchor: e.currentTarget });
        }}
        className={cn(
          "pressable text-left outline-none",
          block
            ? cn(BLOCK_HIGHLIGHT, "focus-visible:bg-accent/40")
            : "transition-colors hover:text-foreground focus-visible:text-foreground",
          className,
        )}
      >
        {children}
      </button>
    </MagneticPreview>
  );
}
