import type { Locale } from "@/lib/i18n";
import {
  computeCommitHash,
  formatCommitDate,
  getCommitTypeLabel,
  getCommitTypePluralLabel,
  isCommitVisibleIn,
  localize,
  localizeOptional,
  resolveIdentity,
  sortCommitsByDate,
  type CommitType,
  type Identity,
  type LogData,
  type RoleCommit,
} from "@/lib/log";

/**
 * The photo an identity falls back to when none is authored for it: the
 * GitHub avatar, the one face every identity is a moment of.
 */
export const DEFAULT_AVATAR = "https://avatars.githubusercontent.com/u/5563315?v=4";

// =============================================================================
// Identity profile — everything the identity card prints, derived once.
//
// An identity is "who I was when I committed this": a handle, a company, and
// the role instances under it. The card is that identity's profile page in
// miniature — the way a GitHub profile is a photo, a handle, a bio and a
// contribution count — read from the same log the timeline renders, so it
// cannot say anything the log does not.
// =============================================================================

export interface ProfileRole {
  id: string;
  title: string;
  /** `2020 – 2022`, `2023 – Present`. */
  dates: string;
  location?: string;
  team?: string;
  description?: string;
  url?: string;
  /** Icon override the role's row wears (`graduation-cap`). */
  icon?: string;
}

export interface ProfileCount {
  type: CommitType;
  label: string;
  count: number;
}

export interface IdentityProfile {
  id: string;
  handle: string;
  company: string;
  avatar?: string;
  /** The identity's own accent, else its era's. */
  accentColor?: string;
  /** The role the card was opened at (or the identity's latest). */
  role: ProfileRole;
  /** Every other role instance under this identity, latest first. */
  otherRoles: ProfileRole[];
  /** The chapter the role belongs to. */
  era?: { title: string; tagline: string };
  /** Commits signed as this identity, by type, most numerous first. */
  counts: ProfileCount[];
  total: number;
  /** The address of the latest commit signed as this identity. */
  latestHref?: string;
}

function toProfileRole(role: RoleCommit, locale: Locale): ProfileRole {
  const description = localize(role.description, locale);
  return {
    id: role.id,
    title: localize(role.title, locale),
    dates: formatCommitDate(role, locale),
    location: role.location,
    team: localizeOptional(role.team, locale),
    description: description.trim() ? description : undefined,
    url: role.url,
    icon: role.icon,
  };
}

export function buildIdentityProfile(
  log: LogData,
  identityId: string,
  roleId: string | undefined,
  locale: Locale,
): IdentityProfile | null {
  const identity: Identity | undefined = log.identities?.[identityId];
  if (!identity) return null;

  const roles = sortCommitsByDate(
    log.commits.filter(
      (c): c is RoleCommit => c.type === "role" && c.identityId === identityId,
    ),
  );
  const role = roles.find((r) => r.id === roleId) ?? roles[0];
  if (!role) return null;

  const era = log.tags.find((t) => t.id === role.tagId);

  // Everything signed as this identity — the same resolution the bylines
  // use, over the commits this locale lists.
  const signed = sortCommitsByDate(
    log.commits.filter(
      (c) =>
        c.type !== "role" &&
        c.type !== "event" &&
        isCommitVisibleIn(c, locale) &&
        resolveIdentity(c, log.commits)?.identityId === identityId,
    ),
  );
  const byType = new Map<CommitType, number>();
  for (const c of signed) byType.set(c.type, (byType.get(c.type) ?? 0) + 1);
  const counts: ProfileCount[] = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({
      type,
      // `1 talk`, `3 talks` — the row's own type label, singular or plural.
      label:
        count === 1
          ? getCommitTypeLabel(type, locale)
          : getCommitTypePluralLabel(type, locale),
      count,
    }));

  return {
    id: identityId,
    handle: identity.handle,
    company: role.companyOverride
      ? localize(role.companyOverride, locale)
      : localize(identity.company, locale),
    avatar: identity.avatar ?? DEFAULT_AVATAR,
    accentColor: identity.accentColor ?? era?.accentColor,
    role: toProfileRole(role, locale),
    otherRoles: roles.filter((r) => r.id !== role.id).map((r) => toProfileRole(r, locale)),
    era: era
      ? { title: localize(era.title, locale), tagline: localize(era.tagline, locale) }
      : undefined,
    counts,
    total: signed.length,
    latestHref: signed[0] ? `/works#${computeCommitHash(signed[0].id)}` : undefined,
  };
}
