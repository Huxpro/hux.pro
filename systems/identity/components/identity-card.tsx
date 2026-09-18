"use client";

import { commitIconOverrides, commitIcons } from "@/components/log/icons";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, useLocale } from "@/services";
import { ANCHORED_PRESENTATION, AdaptiveSurface } from "@/systems/surface";
import { GLASS_ACTION, GLASS_CLUSTER } from "@/systems/theater/lib/chrome";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "next-view-transitions";
import { usePathname } from "next/navigation";
import type { IdentityProfile, ProfileRole } from "../lib/profile";
import { useIdentityCard } from "../provider";

// =============================================================================
// IdentityCard — who I was when I committed this.
//
// A commit's `Role:` field used to open two lines of prose in place. This is
// the same information, and the rest of it, as a profile: a photo from that
// time in a circle, the handle, the company, the role and its tenure, the
// other roles under the same identity, and what was signed with it — the
// GitHub profile page, sized to a card.
//
// Its shape is the reading settings': a sheet on a phone, a popover hanging
// off the pressed handle everywhere else (`ANCHORED_PRESENTATION`), so on a
// desktop it is the hovercard GitHub shows for a name, and on a phone the
// drawer a name opens in any app.
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
        className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-border/50"
        draggable={false}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full",
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
  const Icon =
    (role.icon && commitIconOverrides[role.icon]) || commitIcons.role;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-border/50">
        <Icon className="h-3 w-3 text-tertiary-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <div className={TYPE.rowTitle}>{role.title}</div>
        <div
          className={cn(
            "mt-0.5 flex flex-wrap items-center gap-x-2",
            TYPE.rowMeta,
          )}
        >
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

function Profile({ profile }: { profile: IdentityProfile }) {
  const { locale } = useLocale();
  const { close } = useIdentityCard();
  const pathname = usePathname();
  const { role } = profile;

  return (
    <div className="space-y-4 pt-1">
      {/* The header a profile page opens with: photo, name, handle. */}
      <div className="flex items-center gap-4">
        <Avatar profile={profile} />
        <div className="min-w-0">
          <div className={cn("truncate", TYPE.mediaTitle)}>
            {profile.company}
          </div>
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
          <p className={cn(TYPE.caption, "pl-[1.875rem]")}>
            {role.description}
          </p>
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
          <span
            className={cn(
              TYPE.rowMeta,
              "flex flex-wrap items-baseline gap-x-2",
            )}
          >
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

      {(profile.latestHref || role.url) && (
        <div className={cn(GLASS_CLUSTER, "system-chrome")}>
          {profile.latestHref && (
            <Link
              href={profile.latestHref}
              // The router must not scroll: `useCommitAnchor` takes the hash
              // and eases to it (see TimelineMini for the same reasoning).
              scroll={false}
              onClick={(e) => {
                close();
                // Already on /works: a route push to the same path only swaps
                // the hash and fires no `hashchange`, so the page would not
                // travel. Set the hash the browser's way, which does.
                if (pathname === "/works") {
                  e.preventDefault();
                  window.location.hash =
                    profile.latestHref!.split("#")[1] ?? "";
                }
              }}
              className={cn(GLASS_ACTION, "h-8 px-3")}
            >
              {t(locale, "identityViewLog")}
            </Link>
          )}
          {role.url && (
            <a
              href={role.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(GLASS_ACTION, "h-8 px-3")}
            >
              <span className="max-w-[10rem] truncate">{profile.company}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

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
      title={t(locale, "identityCardTitle")}
      closeLabel={t(locale, "identityCardClose")}
      popover={{ anchor: anchorRef, width: "min(92vw, 380px)" }}
      maxHeight="min(80dvh, 640px)"
      fitContent
    >
      {profile && <Profile profile={profile} />}
    </AdaptiveSurface>
  );
}
