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
draws the badges; `components/log/log-timeline.tsx` places the row.

- **One row per work**, at the lead version's date.
- **The title line names every version**, where the language badge would
  be: `React for Two Threads  EN · 中文`. When the versions differ by
  language the badge is the language; otherwise it is the version's label
  (`Revised · First version`). The one showing is lit; pressing another
  shows it in the row: its title, venue, date, prose, covers and notes.
  The meta line and the strip are the chosen version's, exactly as on any
  other row, so a work in several versions is the same shape as a commit.
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
