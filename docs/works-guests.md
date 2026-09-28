# Guests on /works

Two commits on /works can be one thing to a reader. The Chinese telling of
a talk is the talk again; the talk that introduced a project is the
project's first public moment. Printed a row each, the page says the same
thing twice, and the two sit a screen apart.

So one can be a **guest** on the other's row.

## Data

Two optional fields on any commit (`lib/log.ts`):

```json
{ "id": "see-conf-2025-two-threads",
  "editionOf": "react-universe-2025-two-threads" },
{ "id": "reactconf-2021-memo", "about": ["react-core"] }
```

- `editionOf` points at another telling of the same work. The host is the
  version the chain of pointers ends at.
- `about` names the projects a commit is about; the first one is its host
  when it is a project.

## On the page

`lib/log-hosts.ts` works out who is whose guest; `components/log/log-timeline.tsx`
prints it.

- **The guest is an attachment on the host's row, with a life of its own.**
  The project *attaches* the talk: the talk's covers join the host's strip
  (a talk that introduced a project leads the project's covers; another
  telling of a talk follows the talk's own), and they stay the talk's.
  - Its first cover wears its name where a cover's chip leaves room: its
    language when an edition is in another language (`中文`), otherwise
    where it happened (`React Conf 2021`).
  - Its covers stand together, over one caption that spans them all
    (React without memo's recording and the React Conf 2021 recap post are
    both the talk's): what it is (a talk's title, or where another telling
    was given), then its own hash and date (`fdb0944 Sep 2021`).
  - Its covers behave as the talk's. Pressed, they open natively (the
    recording on the theater's stage, titled with the talk), and on a phone
    the attachment sheet's page for each prints the talk: title, venue,
    hash, date and prose. On a desk, hovering one peeks the talk itself
    instead of the attachment. It is never part of the host row's body.
  - In the feed, its tiles are a section of the host's grid of their own,
    under a ruled line naming it (`React without memo · React Conf 2021`,
    or `SEE Conf 2025 · 中文` for another telling) with its hash and date,
    and ruled off from the host's tiles when it comes first. Its prose
    stays in its peek and its sheet, as on the strip. The index's `📎`
    count includes it.
- **One set.** The row opens everything it prints as one attachment set,
  in the order it prints it (`attachmentSetWith`, systems/attachments), so
  the surface pages through all of it. Each item remembers whose it is
  (`from`, read through `ownerOf`): the surface's page, the theater and the
  window name the guest.
- **Inside the host's time, the guest prints no row.** React without memo
  (Sep 2021) is inside React Compiler's years, so the page reads it on the
  project's row. Its hash still lands there: `/works#<hash>` travels to the
  host.
- **Outside it, one quiet line.** A guest dated away from its host keeps the
  aside's line at its own date, named by where it happened
  (`SEE Conf 2025`), so the timeline still has it when it happened.
  Pressing it takes you to the host's row.

Nothing is merged. A guest is still an ordinary commit: featured, embedded
and linked on its own. Whenever its host is not on the page (`?type=talk`,
a locale scope), it prints as the row it always was.
