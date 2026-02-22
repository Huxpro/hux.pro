/**
 * Commit Type Components
 *
 * Each commit type has its own rendering component.
 * These are the "semantic" views of work items.
 */

// Project
export { ProjectEmbed as Project, ProjectEmbedCompact as ProjectCompact } from "./project-embed";

// Talk
export { TalkEmbed as Talk, TalkEmbedCompact as TalkCompact } from "./talk-embed";

// Post
export { PostEmbed as Post, PostEmbedCompact as PostCompact } from "./post-embed";

// Role
export { RoleEmbed as Role, RoleEmbedCompact as RoleCompact } from "./role-embed";

// Social
export { SocialEmbed as Social, SocialEmbedCompact as SocialCompact } from "./social-embed";

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
  CommitCursorPreview,
} from "./shared";
