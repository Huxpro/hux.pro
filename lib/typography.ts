// =============================================================================
// Typography roles — the one spec production and the lab both render from.
//
// A role is a class string: a size, a family, a tracking, and a rung of the
// ink ladder (docs/system-legibility.md). Components compose a role with their
// own layout classes; the Legibility Lab composes the same role into a
// specimen. That is the whole contract — the lab cannot drift from the site,
// because there is nothing to drift: the same string paints both.
//
// Rungs: `text-foreground` is the ink; `text-muted-foreground` secondary;
// `text-tertiary-foreground` for anything that annotates a neighbour (a date
// beside a title, a caption under it); `text-quaternary-foreground` only for
// what carries no information of its own — separators, the hash column,
// placeholder glyphs. Quaternary is nearly invisible over a picture, which is
// the point for decoration and a bug for text. Never `text-muted-foreground/NN`:
// a modifier on text multiplies the wallpaper boost away.
//
// Mono metadata sits on two rungs by one rule: beside a title it annotates,
// so it is tertiary (`rowMeta`); standing alone it is the information, so it
// is secondary (`meta`).
//
// Where a component needs something no role covers, it writes the classes
// inline and, if it recurs, the role is added here — not the other way round.
// Divergences that are a taste call rather than a bug are listed under
// "Decisions" in docs/system-legibility.md.
// =============================================================================

export const TYPE = {
  /** The system identifier (λhux) and other machine-layer marks. */
  identifier: "font-mono text-xs tracking-wider text-muted-foreground",

  /** Section / widget label: WIDGET titles, the weather condition, WRITING. */
  label: "font-mono text-xs uppercase tracking-wider text-muted-foreground",
  /** The dense version: caption strips in peeks and cards, tag rows. */
  labelSm: "font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground",
  /** A subtitle under a media title: talks captions (`REACT UNIVERSE CONF`). */
  labelWide: "font-mono text-xs uppercase tracking-wide text-muted-foreground",

  /** A row's title: a post in a list, a commit, a track. */
  rowTitle: "text-sm text-foreground",
  /** A media title — the thing that is playing. */
  mediaTitle: "text-sm font-medium leading-snug text-foreground",
  /** Metadata beside a title: the date on a list row, a topic line. */
  rowMeta: "font-mono text-xs text-tertiary-foreground",
  /** Standalone metadata: an article's header line, the artist, sun times. */
  meta: "font-mono text-xs text-muted-foreground",
  /** The hash column: pure decoration, so the one mono role on the
   *  quaternary rung. Everything that carries information sits on tertiary
   *  or above — quaternary is for separators, hashes and placeholders. */
  hash: "font-mono text-xs text-quaternary-foreground",

  /** A description under a title. */
  caption: "text-xs text-muted-foreground leading-relaxed",
  /** A description that should sit behind the caption: an embed's blurb. */
  captionQuiet: "text-xs text-tertiary-foreground leading-relaxed",
  /** An aside: commentary, a life event in the timeline, "featured". */
  aside: "text-xs italic font-serif text-tertiary-foreground leading-relaxed",
  /** Body-sized secondary copy: a widget's description, an empty state. */
  body: "text-sm text-muted-foreground leading-relaxed",

  /** The label under an app icon (`sm` tiles drop to 10px). */
  appLabel: "text-[11px] leading-tight text-muted-foreground",

  /** System navigation: the back link, `retry`, `main`. */
  nav: "font-mono text-xs tracking-wide text-muted-foreground transition-colors duration-200 hover:text-foreground",
  /** An icon or glyph link that brightens on hover. */
  linkQuiet: "text-tertiary-foreground transition-colors hover:text-foreground",

  /** A keyboard hint. */
  kbd: "rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground",
  /** A small tag glued to a title: `featured`, `EN`. */
  pill: "rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
} as const;

export type TypeRole = keyof typeof TYPE;
