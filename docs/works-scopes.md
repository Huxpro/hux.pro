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

- **A branch in the gutter**, drawn the way `git log --graph` draws one:
  a lane a step (8px) right of the rail that grows up out of it. The
  project is the branch's head, the first row you meet scrolling down,
  with its icon on the lane. What it holds follows on the same lane, and
  under the last one the lane curves back into the rail, over the commit
  it grew from. The rail runs past the branch unbroken. The text column
  never moves: the hash stays in the hash column and the title in the
  title column, so nesting costs a phone nothing but the icons' step.
- **Pictures across, the list down.** The page is meant to be read by
  scrolling it quickly, so a scope costs as few lines as it can. The
  project's row carries one strip with every cover in the scope, a segment
  each, in the order things happened: the talk (every version of it), the
  interview, the blog post, the repository. Undated attachments come last;
  a work in several versions counts from its first version; a talk and an
  attachment on the same day, the talk first. Each segment's first cover
  wears its name (`EN`, `Debut abroad`, `React Universe Conf`). On a desk
  the width that sat empty beside a single cover takes most of it; on a
  phone the strip scrolls.
- **Held rows are one line.** What the project holds prints under it as
  rows of their own, each its title line alone (with its version badges)
  until you press it; pressed, it prints its venue, prose and notes. Its
  covers stay on the project's strip. It doesn't sign: the author is the
  project's. A branch's head drops the empty line a hidden handle would
  hold.
- **One control.** The rows and the strip are linked. A row's badge, or
  pressing a row open, brings its covers into view on the strip and lights
  their name; scrolling the strip to a version's covers makes its row read
  that version.
- **Other forms.** The index prints no pictures: the rows are the same
  one-liners and the project counts its own attachments. The feed prints
  everything: each row its own grid, the project its own attachments.
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
