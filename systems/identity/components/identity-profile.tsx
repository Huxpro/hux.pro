"use client";

import { CommitIcon } from "@/components/log/icons";
import { Segmented } from "@/components/ui/controls";
import type { CommitType } from "@/lib/log";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, useLocale } from "@/services";
import { MapPin } from "lucide-react";
import type { IdentityProfile, ProfileRole } from "../lib/profile";

// =============================================================================
// IdentityProfileView: the profile, as a card's contents.
//
// The same block whether it arrives as a hover peek (desktop) or a sheet
// (phone), laid out the way a profile page is: a photo from that time beside
// the role the card was opened at (title, tenure, team, location), its prose
// under both at the card's full width, the other roles under the same
// handle, and what was signed with it as a row of figures. The company and
// the handle are not restated: the mark that opened the card already printed
// them, and the sheet is titled by the handle.
//
// In the peek the figures are a readout and there is nothing to press: the
// peek answers "who was I then?" and nothing more. In the sheet the same row
// is the tabs of the list under it (identity-card.tsx), so the count heads
// the commits it counts instead of sitting beside a second copy of them.
// =============================================================================

/** What the figures filter by: everything, or one type. */
export type ProfileFilter = "all" | CommitType;

/** The photo: authored for the identity, else the GitHub avatar (lib/profile). */
function Avatar({ profile }: { profile: IdentityProfile }) {
  return (
    // A small asset, masked to a circle; no need for the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar}
      alt=""
      className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-border/50"
      draggable={false}
    />
  );
}

/** The opened role's tenure, team and location, on one mono line. */
function RoleMeta({ role }: { role: ProfileRole }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5", TYPE.rowMeta)}>
      <span className="tabular-nums">{role.dates}</span>
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
  );
}

/** Another role under the same handle: a quiet row, its tenure on the right. */
function OtherRole({ role }: { role: ProfileRole }) {
  return (
    <div className="flex items-center gap-2">
      <CommitIcon
        type="role"
        override={role.icon}
        className="h-3 w-3 shrink-0 text-quaternary-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
        {role.title}
      </span>
      <span className={cn("shrink-0 tabular-nums", TYPE.rowMeta)}>{role.dates}</span>
    </div>
  );
}

/** A figure: the number on the ink, what it counts in the label voice under it. */
function Figure({ count, label }: { count: number; label: string }) {
  return (
    <span className="block min-w-0 px-2 py-1 text-left">
      <span className="block text-base font-medium leading-snug tabular-nums text-foreground">
        {count}
      </span>
      <span className={cn("block truncate lowercase leading-4", TYPE.labelSm)}>{label}</span>
    </span>
  );
}

/**
 * The figures: everything signed, then each type, most numerous first. With
 * one type the total would only repeat it, so the type stands alone.
 */
function figuresOf(profile: IdentityProfile, locale: Parameters<typeof t>[0]) {
  const types = profile.counts.map((c) => ({
    value: c.type as ProfileFilter,
    count: c.count,
    label: c.label,
  }));
  if (types.length === 1) return types;
  return [
    { value: "all" as ProfileFilter, count: profile.total, label: t(locale, "identityCommits") },
    ...types,
  ];
}

export function IdentityProfileView({
  profile,
  filter,
  onFilter,
  contributions,
}: {
  profile: IdentityProfile;
  /**
   * The figures as tabs: the card (identity-card.tsx) passes the filter it
   * holds and lists the commits it selects as `contributions`, straight
   * under the figures. The peek, a glance, passes neither, and the figures
   * are a readout.
   */
  filter?: ProfileFilter;
  onFilter?: (filter: ProfileFilter) => void;
  contributions?: React.ReactNode;
}) {
  const { locale } = useLocale();
  const { role } = profile;
  const figures = figuresOf(profile, locale);
  const tabs = onFilter && figures.length > 1;

  return (
    <div className="space-y-4">
      {/* The role the card was opened at, with the photo from that time as
          its mark; its prose under both, at the card's full width. */}
      <div className="space-y-3">
        <div className="flex items-center gap-3.5">
          <Avatar profile={profile} />
          <div className="min-w-0 space-y-1">
            <div className="text-base font-medium leading-snug text-foreground">
              {role.title}
            </div>
            <RoleMeta role={role} />
          </div>
        </div>
        {role.description && <p className={TYPE.caption}>{role.description}</p>}
      </div>

      {/* The same identity's other tenures, e.g. the two summers before the
          full-time years. */}
      {profile.otherRoles.length > 0 && (
        <div className="space-y-1.5">
          <div className={TYPE.labelSm}>{t(locale, "identityOtherRoles")}</div>
          {profile.otherRoles.map((r) => (
            <OtherRole key={r.id} role={r} />
          ))}
        </div>
      )}

      {/* Contributions: what was signed with this handle, as figures; in the
          card, the tabs of the commits under them. */}
      {profile.total > 0 && (
        <div className="space-y-2">
          {tabs ? (
            <Segmented
              tone="reader"
              fill
              value={filter ?? "all"}
              onChange={onFilter}
              options={figures.map((f) => ({
                value: f.value,
                label: <Figure count={f.count} label={f.label} />,
                ariaLabel: `${f.count} ${f.label}`,
              }))}
            />
          ) : (
            <div className="flex divide-x divide-border/40 rounded-lg bg-muted p-0.5">
              {figures.map((f) => (
                <div key={f.value} className="min-w-0 flex-1 px-1 py-1">
                  <Figure count={f.count} label={f.label} />
                </div>
              ))}
            </div>
          )}
          {contributions}
        </div>
      )}
    </div>
  );
}
