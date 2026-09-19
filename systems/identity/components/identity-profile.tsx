"use client";

import { CommitIcon } from "@/components/log/icons";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, useLocale } from "@/services";
import { MapPin } from "lucide-react";
import type { IdentityProfile, ProfileRole } from "../lib/profile";

// =============================================================================
// IdentityProfileView — the profile, as a card's contents.
//
// The same block whether it arrives as a hover peek (desktop) or a sheet
// (phone): a photo from that time in a circle beside the role the card was
// opened at — title, tenure, team, location — and its prose; the other roles
// under the same handle; what was signed with it. The company and the handle
// are not restated: the mark that opened the card already printed them, and
// the sheet is titled by the handle. Nothing to press — the card answers
// "who was I then?" and gets out of the way.
// =============================================================================

/** The photo: authored for the identity, else the GitHub avatar (lib/profile). */
function Avatar({ profile }: { profile: IdentityProfile }) {
  return (
    // A small asset, masked to a circle; no need for the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar}
      alt=""
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-border/50"
      draggable={false}
    />
  );
}

function RoleLine({ role, lead }: { role: ProfileRole; lead?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      {lead ?? (
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-border/50">
          <CommitIcon
            type="role"
            override={role.icon}
            className="h-3 w-3 text-tertiary-foreground"
          />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className={TYPE.rowTitle}>{role.title}</div>
        <div className={cn("mt-0.5 flex flex-wrap items-center gap-x-2", TYPE.rowMeta)}>
          <span>{role.dates}</span>
          {role.team && (
            <>
              <span className="text-quaternary-foreground">·</span>
              <span className="truncate">{role.team}</span>
            </>
          )}
          {role.location && (
            <>
              <span className="text-quaternary-foreground">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {role.location}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function IdentityProfileView({ profile }: { profile: IdentityProfile }) {
  const { locale } = useLocale();
  const { role } = profile;

  return (
    <div className="space-y-4">
      {/* The role the card was opened at, with the photo from that time as
          its mark, and its prose. */}
      <div className="space-y-2">
        <RoleLine role={role} lead={<Avatar profile={profile} />} />
        {role.description && (
          <p className={cn(TYPE.caption, "pl-[3.625rem]")}>{role.description}</p>
        )}
      </div>

      {/* The same identity's other tenures — the two summers before the
          full-time years, say. */}
      {profile.otherRoles.length > 0 && (
        <div className="space-y-2 border-t border-border/40 pt-3">
          <div className={TYPE.labelSm}>{t(locale, "identityOtherRoles")}</div>
          {profile.otherRoles.map((r) => (
            <RoleLine key={r.id} role={r} />
          ))}
        </div>
      )}

      {/* Contributions: what was signed with this handle. */}
      {profile.total > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-border/40 pt-3">
          <span className={cn(TYPE.rowMeta, "tabular-nums")}>{profile.total}</span>
          <span className={TYPE.rowMeta}>{t(locale, "identityCommits")}</span>
          <span className={cn(TYPE.rowMeta, "flex flex-wrap items-baseline gap-x-2")}>
            {profile.counts.map((c) => (
              <span key={c.type} className="inline-flex items-baseline gap-1">
                <span className="text-quaternary-foreground">·</span>
                <span className="tabular-nums">{c.count}</span>
                <span className="lowercase">{c.label}</span>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
