"use client";

import { t, useLocale } from "@/services";
import { ANCHORED_PRESENTATION, AdaptiveSurface } from "@/systems/surface";
import { useIdentityCard } from "../provider";
import { IdentityProfileView } from "./identity-profile";

// =============================================================================
// IdentityCard — the profile as a surface, for a finger.
//
// On a desktop the profile is a hover peek off the handle (identity-hover.tsx)
// and this never opens. On a phone the same mark is tapped and the profile
// comes up as a sheet; on a touch tablet, as a popover hanging off the mark
// (`ANCHORED_PRESENTATION`). The header names the handle, nothing more — a
// profile's name is its title.
// =============================================================================

export function IdentityCard() {
  const { locale } = useLocale();
  const { isOpen, close, profile, anchorRef } = useIdentityCard();

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
    >
      {profile && (
        <div className="pt-1">
          <IdentityProfileView profile={profile} />
        </div>
      )}
    </AdaptiveSurface>
  );
}
