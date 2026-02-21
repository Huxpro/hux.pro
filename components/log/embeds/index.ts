/**
 * Commit Embed Shared Primitives
 *
 * The per-type embed components (ProjectEmbed, TalkEmbed, etc.) have been
 * replaced by generic renderers (CommitCard, CommitCompact, TimelineCommit)
 * powered by the normalizeCommit adapter in commit-data.ts.
 *
 * These shared UI primitives are still used by the generic renderers.
 */

// Shared UI Primitives
export {
  TitleRow,
  LinksRow,
  MetaRow,
  Description,
  Commentary,
  TagBadges,
  Stats,
  ExpandedContent,
  LinkIcon,
} from "./shared";
