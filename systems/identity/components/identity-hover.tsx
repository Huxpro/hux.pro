"use client";

import {
  MagneticPreview,
  PEEK_W,
} from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useInputCapability } from "@/services";
import type { ReactNode } from "react";
import { useIdentityProfile, useOptionalIdentityCard } from "../provider";
import { IdentityProfileView } from "./identity-profile";

// =============================================================================
// IdentityHover — the profile behind a handle, the way the row peeks.
//
// /works already has one hover system: the magnetic peek that follows the
// cursor off a folded row and shows what the row is holding. A handle, a
// `Role:` field and a role row are the same kind of thing — a name that
// stands for more than it prints — so they peek the same way. No click, no
// close: the card arrives with the pointer and leaves with it.
//
// Where there is no pointer (a phone, a touch tablet) the same mark is a
// button, and a tap opens the identity card as a sheet. One trigger, two
// behaviours, chosen by the input rather than by the viewport.
// =============================================================================

/** The panel a profile peek arrives in: a visible card, so it lifts. */
export const IDENTITY_PEEK_PANEL = cn(PEEK_W, "p-4 shadow-raised");

/** The peek's contents. Mounted only while hovered, so the profile is
 *  derived for the one identity being looked at. */
export function IdentityPeek({
  identityId,
  roleId,
}: {
  identityId: string;
  roleId?: string;
}) {
  const profile = useIdentityProfile(identityId, roleId);
  if (!profile) return null;
  return <IdentityProfileView profile={profile} />;
}

interface IdentityHoverProps {
  identityId: string;
  roleId?: string;
  /** Classes for the mark itself (the text). */
  className?: string;
  /** Classes for the wrapper the peek attaches to — a flex item's `shrink-0`. */
  wrapperClassName?: string;
  children: ReactNode;
}

export function IdentityHover({
  identityId,
  roleId,
  className,
  wrapperClassName,
  children,
}: IdentityHoverProps) {
  const card = useOptionalIdentityCard();
  const { magneticPreviewEnabled } = useInputCapability();

  if (!card) return <span className={className}>{children}</span>;

  return (
    <MagneticPreview
      preview={<IdentityPeek identityId={identityId} roleId={roleId} />}
      panelClassName={IDENTITY_PEEK_PANEL}
      className={cn("inline-block max-w-full align-baseline", wrapperClassName)}
    >
      <button
        type="button"
        onClick={(e) => {
          // With a pointer the peek has already said everything; the tap
          // path is for a finger, which cannot hover.
          if (magneticPreviewEnabled) return;
          e.stopPropagation();
          card.open({ identityId, roleId, anchor: e.currentTarget });
        }}
        className={cn(
          "text-left transition-colors hover:text-foreground",
          "pressable outline-none focus-visible:text-foreground",
          className,
        )}
      >
        {children}
      </button>
    </MagneticPreview>
  );
}
