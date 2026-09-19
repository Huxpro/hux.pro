/**
 * Byline derivation — the per-commit `git log --pretty=fuller` author
 * context shared by the /works timeline and the home "processing" widget.
 *
 * Handle + company come from the shared identity metadata; title / tenure /
 * description come from the specific role instance that owns the commit's
 * date. Two Meta interns and the Meta SWE tenure all resolve
 * identity="meta" (same `<jsx@fb.com>`, same "Meta"), but each expands to
 * its own role instance context.
 */

import type { Locale } from "@/lib/i18n";
import {
  type Commit,
  type Identity,
  localize,
  resolveIdentity,
} from "@/lib/log";

export interface Byline {
  /** The identity the commit was made as — the key into `identities`. */
  identityId: string;
  /** The specific role instance, when one owns the commit's date. */
  roleId?: string;
  handle: string;
  /**
   * Per-identity: the first row of a contiguous same-identity run shows
   * the handle at rest; the rest fade in on per-row hover so the list
   * reads as "one identity per chapter".
   */
  isClusterHead: boolean;
  /**
   * Effective team subtitle for a project row, computed as
   * `project.team ?? role.team`. Only set when the row is a project AND
   * this is the first row in a contiguous same-team run — repeats render
   * blank (sparse). Non-projects get undefined here (their subtitle comes
   * from `data.meta` — talk conference, publication, platform).
   */
  subtitle?: string;
  expanded: {
    title: string;
    company: string;
    location?: string;
    description?: string;
  };
}

/**
 * Compute a byline for every row in `commits` (already sorted in display
 * order). Rows with no resolvable identity get `null`.
 */
export function computeBylines(
  commits: Commit[],
  identities: Record<string, Identity> | undefined,
  locale: Locale,
): (Byline | null)[] {
  const result: (Byline | null)[] = commits.map(() => null);
  let prevIdentityId: string | null = null;
  let prevProjectTeam: string | null = null;

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i];
    const resolved = resolveIdentity(c, commits);
    if (!resolved) {
      prevIdentityId = null;
      continue;
    }
    const identity = identities?.[resolved.identityId];
    if (!identity) {
      prevIdentityId = null;
      continue;
    }
    const isClusterHead = resolved.identityId !== prevIdentityId;
    prevIdentityId = resolved.identityId;

    // Prefer role-instance details when we have a specific role (title /
    // dates / description differ per intern vs FTE etc.). Fall back to
    // identity-level defaults when there's no role fit — e.g. an award
    // received a month after tenure ended, linked only via `identityId`.
    const role = resolved.role;
    const company = role?.companyOverride
      ? localize(role.companyOverride, locale)
      : localize(identity.company, locale);
    const title = role ? localize(role.title, locale) : "";
    const desc = role ? localize(role.description, locale) : "";

    // Effective team subtitle: project override wins, otherwise inherits
    // the role's team default. Sparse — blank the chip when it repeats the
    // previous project's team so a Lynx-era run of 10 projects all
    // inheriting `Lynx @ ByteDance` prints the chip once at the top and
    // stays quiet after.
    let subtitle: string | undefined;
    if (c.type === "project") {
      const teamRaw = c.team ?? role?.team;
      const teamStr = teamRaw ? localize(teamRaw, locale) : undefined;
      if (teamStr && teamStr !== prevProjectTeam) {
        subtitle = teamStr;
        prevProjectTeam = teamStr;
      } else if (teamStr) {
        // Same team as previous project — blank, but keep tracker.
        prevProjectTeam = teamStr;
      }
      // (If teamStr is undefined we leave prevProjectTeam untouched so a
      //  project with no team doesn't reset the streak.)
    }

    result[i] = {
      identityId: resolved.identityId,
      roleId: role?.id,
      handle: identity.handle,
      isClusterHead,
      subtitle,
      expanded: {
        title,
        company,
        location: role?.location,
        description: desc && desc.trim() ? desc : undefined,
      },
    };
  }

  return result;
}
