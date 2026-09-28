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

- **The guest's covers join the host's strip.** The talk that introduced a
  project leads the project's covers; another telling of a talk follows
  the talk's own. The guest's first cover wears its name where a cover's
  chip leaves room: its language when an edition is in another language
  (`中文`), otherwise where it happened (`React Conf 2021`). Each cover
  opens the guest's own attachments. The feed's grid and the index's `📎`
  count include them too.
- **Inside the host's time, the guest prints no row.** React without memo
  (Sep 2021) is inside React Compiler's years, so the page reads it on the
  project's row. Its hash still lands there: `/works#<hash>` travels to the
  host.
- **Outside it, one quiet line.** A guest dated away from its host keeps the
  aside's line at its own date, named by where it happened
  (`SEE Conf 2025`), so the timeline still has it when it happened.
  Pressing it opens it in place like any aside.

Nothing is merged. A guest is still an ordinary commit: featured, embedded
and linked on its own. Whenever its host is not on the page (`?type=talk`,
a locale scope), it prints as the row it always was.
