# Scopes on /works

A project going public is rarely one thing. Lynx going open source was a
blog post, a repository and a talk given in China and then abroad. React
Compiler went public as a talk at React Conf, and then came the write-ups.
Printed a row each, the page repeats itself; printed as the project alone,
the talk that mattered most is gone. A project can hold that cluster.

## Data

Optional fields (`lib/log.ts`):

```json
{ "id": "d2-2025-lynx", "about": ["lynx-framework"] },
{ "id": "lynx-framework", "type": "project",
  "date": "2023-02", "endDate": "present", "publicDate": "2025-03",
  "media": [{ "kind": "link", "url": "…/blog/lynx-unlock-native-for-more",
              "date": "2025-03-05" }, …] }
```

- `about` on a talk, post or press lists the projects it is about. The first
  is the one it belongs to. There is no release type: a project that other
  work belongs to is a scope.
- `publicDate` on a project is when it went public. A project's span (`date`
  to `endDate`) is when the work happened, and spans overlap; the moment it
  went public is a point, so that is where the row sits and the date it
  prints. The span moves to the row's notes (`Active: 2023 – Present`), so
  the row prints one date.
- `date` on an attachment is when it happened. It places the attachment
  among the project's talks.

A work in several versions (docs/works-editions.md) belongs as one: it joins
the project any of its versions is about, and prints as its one row.

Nothing is merged. Every commit can still be featured, embedded and linked
on its own.

## On the page

`lib/log-scopes.ts` works out who belongs where; `components/log/log-timeline.tsx`
renders it.

- **Across, in the covers form.** The covers run across the page, so the
  commits they belong to run across with them: the project's strip is its
  branch turned on its side (`components/log/media/segmented-strip.tsx`).
  Each held work is a node on a line through the strip, with its title,
  and a column per version under it, captioned with what, where and when
  (`Debut in China · 第 19 届 D2…  Mar 2025`). The project's own attachments
  sit on the same line where they happened: the blog post after the talk,
  the repository last (undated attachments come last; a work in several
  versions counts from its first version; a talk and an attachment on the
  same day, the talk first). Nothing prints under the project: the scope is
  one row, and on a desk the strip takes the width that sat empty beside a
  single cover. On a phone it scrolls.
- **One of them is lit.** A caption pressed is chosen, and its commit's
  prose prints under the strip (press it again to put it away). Scrolling
  the strip by hand to another version's covers makes its work read that
  version. Arriving at `/works#<hash>` of something a project holds lands on
  the project with its column chosen and in view.
- **Down, in the index and the feed.** The index prints no pictures and the
  feed prints every row whole, so there what the project holds follows it
  as rows of their own, on a branch of the gutter drawn the way
  `git log --graph` draws one: a lane a step (8px) right of the rail that
  grows up out of it, with the project as its head, and curves back into
  it under the last row. A held row prints its title line (and, in the
  feed, its pictures) until pressed; it doesn't sign, the author is the
  project's. The text column never moves.
- A project that holds work drops the empty line a hidden handle would
  hold under its title.
- **Quiet lines.** A held commit dated outside every row that holds it
  keeps a quiet line at its own date that takes you there (`↑` / `↓`).
  Inside the project's span it gets none: React without memo is inside the
  years React Compiler spans, so a reader looking at 2021 already finds it.

## Places that reference a project

A featured group can name a project instead of listing its talks. The home
talk albums (`systems/theater/lib/albums.ts`) play what the project holds,
one version per talk (the one leading in the reader's language).
`featured-lynx-talks` names `react-lynx` and `lynx-framework`.

## When it doesn't apply

Work only joins a project that is on the page. With `?type=talk` the
projects are filtered out and every talk prints as the ordinary row it is.
