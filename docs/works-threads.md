# Threads on /works: editions and releases

Two things on /works are really one thing printed in several rows:

- **Editions.** The same talk told more than once: an English original and a
  Chinese edition, a debut in China and a debut abroad, a re-run at another
  conference, a revised version a few months later.
- **Releases.** A project and the work that introduced it: Lynx going open
  source and the talks that announced it, lynx-ui and the talk that launched
  it, React Compiler and React without memo.

Each piece stays its own commit, with its own date, venue and video. Two
pointers say how they relate. Nothing is merged: every commit can still be
featured in a home widget, embedded in a post and linked on its own.

## Data

Optional fields on any commit (`lib/log.ts`):

```json
{
  "id": "see-conf-2025-two-threads",
  "editionOf": "react-universe-2025-two-threads",
  "edition": { "en": "Chinese edition", "zh": "中文版" }
}
{
  "id": "d2-2025-lynx",
  "about": ["lynx-open-source"]
}
```

- `editionOf` points at the original. It can point at another edition; the
  chain is followed to its end, so an original holds one flat list.
- `edition` says what this telling is, relative to the original. Optional.
- `about` lists the projects a commit is about. The first one is where it
  belongs. There is no release type: a release is a project that other work
  points at. Only work (talks, posts, press) is threaded under a project;
  a project that is about another project is a branch, and that is the tree
  view's job.

An edition goes wherever its original goes. The D2 talk belongs to "Lynx
goes open source", so its two editions sit inside it too, three levels deep.

## On the page

`lib/log-threads.ts` works out who sits inside whom;
`components/log/log-timeline.tsx` renders it.

- **At the child's own date** it keeps one quiet line, in the aside voice:
  `SEE Conf 2025 · Chinese edition ↓`, `React Conf 2021 · React without
  memo ↓`. The arrow says the full row is elsewhere on the page and which
  way (`↗` on a meta line leaves the site; `↓` / `↑` stays on it). If the
  child is in the same month as the row that holds it, there is no line:
  the two rows would sit next to each other anyway.
- **An original** counts its editions on the meta line (`+1 edition`). When
  the row is open (pressed, or in the feed) they are listed under it, folded
  to the same line, each opening in place like an aside.
- **A project** counts its work on the meta line (`3 talks`, editions
  included) and lists it under its covers, one row each, as the index prints
  rows: title, venue, attachment count. On a desktop the row peeks its covers
  on hover; pressed, it opens in place. In the feed they follow the feed.
- **Pressing a quiet line** opens every row on the way down to the child,
  travels there, and marks it the way a permalink arrival does. If the child
  fits on screen, the outermost row's title is brought to the top so you can
  see what it belongs to.
- **Permalinks.** `/works#<hash>` of a nested commit lands the same way.
  The quiet line has no id; the nested row is the commit's address.
  `useCommitAnchor` asks the timeline to reveal a hash it can't find.

Nested rows keep their own gutter instead of hanging it in the page margin.
On a phone the hash column is hidden and the icon column shrinks to the
icon, so each level costs 18px. From `@sm` up the nested hash shows and the
nesting reads as a small `git log` inside the row. A thin line, drawn like
the tenure rail, hangs from the top of each list to its last row.

## Places that reference a release

A featured group can name a release instead of listing its talks. The home
talk albums (`systems/theater/lib/albums.ts`) expand a project into the work
about it (`workAbout`), newest first, so `featured-lynx-talks` names
`lynx-open-source` once and plays the D2 and React Summit talks.

## When it doesn't apply

A child only joins its parent when the parent is on the page too. With
`?type=talk` the projects are filtered out, so every talk prints as the
ordinary row it is. The same goes for a locale scope or a typo.
