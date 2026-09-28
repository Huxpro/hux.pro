# Editions on /works

The same talk often exists more than once: an English original and a Chinese
edition, a debut in China and a debut abroad, a re-run at another
conference, a revised version a few months later. Each version is still its
own commit, with its own date, venue and video. Looking back, though, they
are the same work, and none of them is "the" original: they are
alternatives.

## Data

Optional fields on any commit (`lib/log.ts`):

```json
{ "id": "react-universe-2025-two-threads", "lead": true },
{ "id": "see-conf-2025-two-threads",
  "editionOf": "react-universe-2025-two-threads",
  "edition": { "en": "Chinese edition", "zh": "中文版" } }
```

- `editionOf` points at another version of the same work. The versions a
  chain of these connects are one work; which one points at which does not
  matter for how they print.
- `edition` says what this version is: `中文版`, `海外首发`, `升级版`.
- `lead` makes a version lead its work's row. `true` always; `"en"` or
  `"zh"` only on the page in that language, for a talk given in both where
  the reader should see the one in their language first. Without any, the
  version the pointers end at leads.
- `present: "aside"` on a version puts it last among the badges.

Nothing is merged. Every version can still be featured in a home widget,
embedded in a post and linked on its own.

## On the page

`lib/log-editions.ts` groups the versions; `components/log/versions.tsx`
draws the badges; `components/log/media/segmented-strip.tsx` the versions across the strip; `components/log/log-timeline.tsx` places the row.

- **One row per work**, at the lead version's date.
- **The versions run across the row.** In the covers form the row's strip
  holds every version as a column over its own covers, captioned with what
  it is, where and when: `EN · React Universe Conf  Sep 2025`,
  `中文 · SEE Conf 2025  Nov 2025` (`components/log/media/segmented-strip.tsx`).
  Nothing is behind a press, and it is one line of covers where a strip per
  version would cost a line each; on a desk it takes the width that sat
  empty beside a single cover, on a phone the strip scrolls.
- **One of them is the row's.** The lit caption is the version the row is
  reading: its title, date and prose are the row's text. Pressing another
  caption, or scrolling the strip by hand to another version's covers,
  makes the row read that one. The row's own venue line would repeat the
  lit caption, so it folds away until the row is pressed open.
- **Elsewhere, badges.** The index prints no covers, so there the title
  line names the versions instead, where the language badge would be
  (`React for Two Threads  EN · 中文`; a label such as `Revised` when the
  versions don't differ by language), and pressing a badge switches. The
  feed prints the chosen version.
- **A version dated outside the row's time** keeps one quiet line at its
  own date: `FEDAY 2023 · First version ↑`. The arrow says the row is
  elsewhere on the page and which way. Pressing it chooses that version and
  travels to the row. A version inside the row's time gets no line: the row
  is where a reader looks for that stretch of time anyway.
- **Permalinks.** `/works#<hash>` of any version lands on its work's row
  with that version showing. The row answers to its lead's hash; the other
  hashes are resolved by the timeline (`registerCommitRevealer`).

## When it doesn't apply

A version only joins its work when it is on the page. A type filter or a
locale scope that leaves one version standing prints it as the ordinary row
it is.
