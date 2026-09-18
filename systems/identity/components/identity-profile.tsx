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
// (phone): a photo from that time in a circle, the company, the handle, the
// era; the role the card was opened at with its tenure and prose; the other
// roles under the same handle; what was signed with it. Nothing to press —
// the card answers "who was I then?" and gets out of the way.
// =============================================================================

/** The photo, or the monogram standing in for it. */
function Avatar({ profile }: { profile: IdentityProfile }) {
  const accent = profile.accentColor ?? "var(--foreground)";
  if (profile.avatar) {
    // A small authored asset, masked to a circle; no need for the optimizer.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar}
        alt=""
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border/50"
        draggable={false}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-full",
        "font-serif text-2xl text-foreground ring-1 ring-inset ring-border/50",
      )}
      style={{
        // The era's accent at a whisper, so the eight identities read apart
        // without any one of them shouting.
        background: `color-mix(in oklab, ${accent} 14%, transparent)`,
      }}
    >
      {[...profile.company][0]}
    </span>
  );
}

function RoleLine({ role }: { role: ProfileRole }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-border/50">
        <CommitIcon
          type="role"
          override={role.icon}
          className="h-3 w-3 text-tertiary-foreground"
        />
      </span>
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
      {/* The header a profile page opens with: photo, name, handle. */}
      <div className="flex items-center gap-3.5">
        <Avatar profile={profile} />
        <div className="min-w-0">
          <div className={cn("truncate", TYPE.mediaTitle)}>{profile.company}</div>
          <div className={cn("mt-0.5 truncate", TYPE.rowMeta)}>
            &lt;{profile.handle}&gt;
          </div>
          {profile.era && (
            <div className={cn("mt-1 truncate", TYPE.labelSm)}>
              {profile.era.title} · {profile.era.tagline}
            </div>
          )}
        </div>
      </div>

      {/* The role the card was opened at, and its prose. */}
      <div className="space-y-2">
        <RoleLine role={role} />
        {role.description && (
          <p className={cn(TYPE.caption, "pl-[1.875rem]")}>{role.description}</p>
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
          <span className={cn(TYPE.rowMeta, "text-foreground tabular-nums")}>
            {profile.total}
          </span>
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
