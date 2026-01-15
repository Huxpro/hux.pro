// Log System Components
// Git Log / Commit History style visualization of career history

export { LogTimeline } from "./log-timeline";
export { CommitEmbed } from "./commit-embed";
export { commitIcons } from "./icons";

// Type-specific embeds
export {
  ProjectEmbed,
  TalkEmbed,
  PostEmbed,
  RoleEmbed,
  SocialEmbed,
} from "./embeds";

// Re-export types for convenience
export type { CommitEmbedProps, CommitEmbedVariant } from "./commit-embed";
