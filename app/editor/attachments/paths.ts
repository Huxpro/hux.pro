/**
 * Every place a commit's media is drawn, and where a press sends it.
 *
 * The attachments lab prints this table next to live specimens so a new
 * kind or a new surface has a row to land in. Policy (where a tap goes)
 * is `systems/attachments/lib/policy.ts`; this is the *drawing* map.
 */

export type RenderSurfaceId =
  | "strip"
  | "grid-desk"
  | "grid-phone"
  | "inline-playable"
  | "renderer"
  | "renderer-rail"
  | "renderer-pills"
  | "peek"
  | "peek-deck"
  | "page"
  | "rail-thumb"
  | "mdx"
  | "widget";

export interface RenderPath {
  id: RenderSurfaceId;
  /** The production component. */
  surface: string;
  /** Where it prints. */
  context: string;
  /** What a click does (or "—", when the surface is not a door). */
  click: string;
  /** File to open. */
  file: string;
}

export const RENDER_PATHS: readonly RenderPath[] = [
  {
    id: "strip",
    surface: "MediaStrip → AttachmentTile",
    context: "/works covers — one row per commit, under the description",
    click: "open() → homeFor (sheet on a phone, native home elsewhere)",
    file: "components/log/media/media-strip.tsx",
  },
  {
    id: "grid-desk",
    surface: "AttachmentGrid (desk)",
    context: "/works feed, sm and up — pair / lone card / lone playable",
    click: "act() → nativeHomeFor (stage, window, route, tab)",
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "grid-phone",
    surface: "AttachmentGrid (phone)",
    context: "/works feed, < sm — edge-to-edge stack",
    click: "act() on a card; a recording/deck plays in place",
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "inline-playable",
    surface: "InlinePlayable",
    context: "Phone feed: 16:9 cover swaps for the player; PiP hands off",
    click: "play in place · PiP → act() (theater / PiP)",
    file: "components/log/media/attachment-grid.tsx",
  },
  {
    id: "renderer",
    surface: "MediaRenderer",
    context:
      "MDX \u003cMedia /\u003e, and whatever the grid has no cover for — a live\n       social widget. Nothing else on /works reaches it any more.",
    click: "open() when a set is handed in; else inline / \u003ca\u003e",
    file: "components/log/media/media-renderer.tsx",
  },
  {
    id: "renderer-rail",
    surface: "MediaRenderer · CardScrollRail",
    context: "MDX / pinned: 2+ rich items side by side",
    click: "same as MediaRenderer",
    file: "components/log/media/media-renderer.tsx",
  },
  {
    id: "renderer-pills",
    surface: "MediaRenderer · Link pill",
    context: "Folded rail icons · pill-only commits · MDX pills",
    click: "plain <a> — pills are not in the attachment set",
    file: "components/log/media/link.tsx",
  },
  {
    id: "peek",
    surface: "PeekCard / PeekThumb",
    context: "Hover on a strip cover, or a single-item index-form peek",
    click: "— (the cover underneath is the door)",
    file: "components/log/media/media-peek.tsx",
  },
  {
    id: "peek-deck",
    surface: "StackedPeek",
    context: "/works index: 2+ peek items on a folded row",
    click: "— (the row opens)",
    file: "components/log/commit-embed.tsx",
  },
  {
    id: "page",
    surface: "AttachmentPage",
    context: "Attachment sheet / panel / window, one page per item",
    click: "native action (Watch / Slides / Visit / Read)",
    file: "systems/attachments/components/attachment-page.tsx",
  },
  {
    id: "rail-thumb",
    surface: "TrackThumb",
    context: "Theater playlist rail · the home Featured Talks card",
    click: "select the track on the stage",
    file: "systems/theater/components/track-thumb.tsx",
  },
  {
    id: "mdx",
    surface: "Media",
    context: "MDX in /writing — URL in, kind detected",
    click: "inline player / card link; no attachment set",
    file: "components/log/media/media.tsx",
  },
  {
    id: "widget",
    surface: "FeaturedTalksWidget → TrackThumb",
    context: "Home: the same snap-pager the attachment sheet pages with",
    click: "useTheater().open — the stage, never the attachment set",
    file: "components/home/featured-talks-widget.tsx",
  },
];
