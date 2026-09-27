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

- **A branch in the gutter.** What a project holds prints right under it,
  as rows of their own. The project's icon forks a line a step right of the
  rail, and each held row has its icon on that line; the line ends at the
  last one. The text column never moves: the hash stays in the hash column
  and the title in the title column, so nesting costs a phone nothing but
  the icon's 8px step. The tenure rail runs on past the branch as before.
- **Always printed, a step quieter.** Held rows follow the page's form
  (index rows in the index, covers in covers, the feed in the feed), minus
  their prose: title, venue and covers, and the description only when you
  press the row. They don't sign: the author is the project's.
- **Attachments are entries too.** The project's own attachments move off
  its row onto the branch, a dot on the line and a strip per run, so the
  held rows and the attachments are one chronology in the order they
  happened: the talk, then the post that followed it. A talk and an
  attachment on the same day: the talk first. Undated attachments (a
  repository) come last. A work in several versions counts from its first
  version. The index prints no pictures, so there the attachments stay on
  the project's row, counted on its title line.
- **Quiet lines.** A held commit dated outside every row that holds it
  keeps a quiet line at its own date that takes you there (`↑` / `↓`).
  Inside the project's span it gets none: React without memo is inside the
  years React Compiler spans, so a reader looking at 2021 already finds it.
- **Permalinks.** A held row is an ordinary row with the commit's address,
  so `/works#<hash>` lands on it.

## Places that reference a project

A featured group can name a project instead of listing its talks. The home
talk albums (`systems/theater/lib/albums.ts`) play what the project holds,
one version per talk (the one leading in the reader's language).
`featured-lynx-talks` names `react-lynx` and `lynx-framework`.

## When it doesn't apply

Work only joins a project that is on the page. With `?type=talk` the
projects are filtered out and every talk prints as the ordinary row it is.
