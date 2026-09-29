# Guests on /works

Two commits on /works can be one thing to a reader. The Chinese telling of
a talk is the talk again; the talk that introduced a project is the
project's first public moment. Printed a row each, the page says the same
thing twice, and the two sit a screen apart.

So one can be a **guest** on the other's row.

## Data

Optional fields on any commit (`lib/log.ts`):

```json
{ "id": "see-conf-2025-two-threads",
  "editionOf": "react-universe-2025-two-threads",
  "featuredAs": { "en": "Chinese re-run", "zh": "中文再演" } },
{ "id": "reactconf-2021-memo", "about": ["react-core"],
  "featuredAs": { "en": "Intro talk", "zh": "首发演讲" } }
```

- `editionOf` points at another telling of the same work. The host is the
  version the chain of pointers ends at.
- `about` names the projects a commit is about; the first one is its host
  when it is a project.
- `featuredAs` says why the guest is on its host's row. It is the badge on
  the guest's first cover, the most visible place the guest has, so it
  names the connection rather than repeat what the caption prints.

## On the page

`lib/log-hosts.ts` works out who is whose guest; `components/log/log-timeline.tsx`
prints it.

- **The guest is an attachment on the host's row, with a life of its own.**
  The project *attaches* the talk: the talk's covers join the host's strip
  (a talk that introduced a project leads the project's covers; another
  telling of a talk follows the talk's own), and they stay the talk's.
  - Its first cover wears a badge where a cover's chip leaves room: its
    `featuredAs` (`Intro talk`, `Chinese re-run`). Without one, an edition
    in another language wears the language (`中文`), and anything else
    wears none.
  - Several covers of one guest lie in a pile, one cover wide
    (`GuestDeck`, components/log/media/media-strip.tsx): the first on
    top, the others behind it a step smaller and fainter, each showing a
    sliver past the one in front. React without memo's recording lies on
    top of the React Conf 2021 recap post, the lesser media there but out
    of the way. It is the row's stacked peek laid flat: the strip scrolls
    sideways, so the pile stays inside a cover's height. On a pointer,
    hovering the pile fans the slivers out; each sliver is its own cover,
    pressed and peeked as any cover is. On a phone the pile rests, and the
    sheet pages through it like the rest of the row.
  - Under its cover or its pile is one caption: the mark its row wears in
    the gutter (a talk's mic, so the covers read as a commit and not as
    attachments), its title and where it was given
    (`React without memo · React Conf 2021`), wrapping with the venue
    whole. A pile is one thing, so no rule is needed to hold its covers
    together.
  - Its covers behave as the talk's. Pressed, they open natively (the
    recording on the theater's stage, titled with the talk). A commit's
    particulars are for a closer look: on a phone the attachment sheet's
    page for each prints the talk (title, venue, hash, date and prose); on
    a desk, hovering one peeks the cover as any cover peeks, with a last
    line saying whose it is: its mark, title, hash and date
    (`React without memo  fdb0944 Sep 2021`). It is never part of the host
    row's body.
  - In the feed, its tiles are a section of the host's grid of their own,
    under a ruled line naming it as the strip does, with its `featuredAs`
    as a tag (the feed's tiles wear no badge) and its hash and date, and
    ruled off from the host's tiles when it comes first. Its prose stays in
    its sheet, as on the strip. The index's `📎` count includes it.
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
and linked on its own.

- **Filters follow the containment.** The host holds the guest, so the
  filter reads it that way round. With the host on the page and only the
  guest's type filtered out (`?type=project`), the guest still rides on
  its host's row, covers and all, and its hash still lands there; it just
  has no row or quiet line of its own. Whenever its host is not on the
  page (`?type=talk`, a locale scope), it prints as the row it always was.

