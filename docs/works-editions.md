# Editions on /works

The same talk often exists more than once: an English original and a Chinese
edition, a debut in China and a debut abroad, a re-run at another
conference, a revised version a few months later. Each telling is still its
own commit, with its own date, venue and video. What was missing was a way
to say they are the same work.

## Data

Two optional fields on any commit (`lib/log.ts`):

```json
{
  "id": "see-conf-2025-two-threads",
  "editionOf": "react-universe-2025-two-threads",
  "edition": { "en": "Chinese edition", "zh": "中文版" }
}
```

- `editionOf` points at the original. It can point at another edition; the
  chain is followed to its end, so an original holds one flat list.
- `edition` is what this telling is, relative to the original. Optional.

Nothing is merged. An edition can still be featured in a home widget,
embedded in a post, and linked on its own.

## On the page

`lib/log-editions.ts` builds the threads; `components/log/log-timeline.tsx`
renders them.

- **The edition's own date.** It keeps one quiet line, in the aside voice:
  `SEE Conf 2025 · Chinese edition ↓`. The arrow says the full row is
  elsewhere on the page and which way (`↗` on a meta line leaves the site;
  `↓` / `↑` stays on it).
- **The original.** Its meta line counts what it holds (`+1 edition`).
  When the row is open (pressed, or in the feed), its editions are listed
  under it as nested rows, each one folded to the same line, and each one
  opens in place like an aside.
- **Pressing the quiet line** opens the original and the edition inside it,
  travels there, and marks it the way a permalink arrival does. If the
  edition fits on screen, the original's title is brought to the top so you
  can see what it belongs to.
- **Permalinks.** `/works#<edition hash>` lands the same way. The quiet line
  has no id; the nested row is the edition's address. `useCommitAnchor` asks
  the timeline to reveal a hash it can't find before giving up.

Nested rows keep their own gutter instead of hanging it in the page margin.
On a phone the hash column is hidden, so the nesting costs one icon column
(28px). From `@sm` up the nested hash shows, and the nesting reads as a small
`git log` inside the row. A thin line, drawn like the tenure rail, hangs
from the top of the list to the last edition.

## When it doesn't apply

An edition only joins its original when the original is on the page too.
If a type filter, a locale scope or a typo leaves the original out, the
edition prints as the ordinary row it is.
