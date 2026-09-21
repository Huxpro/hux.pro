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
  labelSm:
    "font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground",
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
  /**
   * A second voice under a statement: the witnesses in a /prompt chorus and
   * my own aside beside them. One role for both, because the difference
   * between "someone else said this" and "this is how I say it" should be
   * carried by the quotation marks and one rung of ink, not by a different
   * size and a different family. Borrowed words sit on this rung; mine
   * override to tertiary at the call site.
   *
   * Three semantic objects, two sizes, two faces — and the face belongs to
   * the role, never to the position:
   *
   *   a conviction   serif, large
   *   a voice        serif, 14px — upright, whoever said it. A quotation
   *                  already carries its marks and its papers, and a line
   *                  without either is mine; italic would be a third signal
   *                  for a fact already twice stated. It would also be a
   *                  signal one of this page's two scripts cannot make:
   *                  the CJK serif has no oblique, so the browser shears
   *                  the glyphs, which Chinese typography has never done.
   *   provenance     sans, 14px, muted — under a statement, trailing a
   *                  voice, after a title, anywhere
   *
   * One size for the whole second level, and it is the size the instances
   * already use: the front of an entry and the notes behind it differ by
   * face and by rung, not by scale.
   *
   * Latin gets a step of optical correction, the same +6.25% the article
   * prose makes: Newsreader's x-height is 44/100 against Inter's 54.6, so
   * serif set at the sans size reads small beside it — and in this band a
   * quotation and its source sit on the same line, which is exactly where
   * that shows. Matching the x-heights outright would take +24% and blow
   * the serif's cap height past the sans; the correction is a taste, not a
   * calculation. Chinese takes none: Noto Serif SC and Inter already meet.
   *
   * So a source keeps the same face whether it sits on its own line or
   * inside a sentence. That is what makes the site's two alphabets legible
   * without a legend: serif is somebody's thinking, sans and mono are the
   * system talking about it.
   */
  voice:
    "font-serif text-sm [&:lang(en)]:text-[0.9375rem] text-muted-foreground leading-relaxed",
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
