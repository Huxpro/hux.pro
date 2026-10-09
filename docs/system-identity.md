# Identity System

Who I was when I committed this.

```
systems/identity/
├── provider.tsx                      # IdentityCardProvider, useIdentityCard(), useIdentityProfile()
├── lib/profile.ts                    # buildIdentityProfile(log, identityId, roleId, locale)
└── components/
    ├── identity-profile.tsx          # IdentityProfileView: the card's contents
    ├── identity-hover.tsx            # IdentityHover / IdentityPeek: the desktop hover peek
    └── identity-card.tsx             # the sheet a finger opens (AdaptiveSurface)
```

## The problem

Every commit on `/works` is signed by an identity (`<jsx@fb.com>`,
`<@bytedance>`, `<rit.edu>`), and each identity holds one or more roles: the
two Meta summers and the full-time years are three roles under one handle.
The row's `Role:` field used to open the role's two lines of prose in place,
and that was all a role could say. The rest of what the log knows about a
tenure had no surface: its dates, location and team, the other roles under
the same handle, and what was signed with it.

## The card

A handle, a `Role:` field, or a role row stands for the identity's card: a
GitHub profile page sized to a card, with nothing to press.

- **The role** the card was opened at, laid out as a profile page's head: a
  photo from that time, masked to a circle (`Identity.avatar` in
  `content/log.json`, a site-local path or URL; the GitHub avatar stands in
  until one is authored, `DEFAULT_AVATAR` in `lib/profile.ts`), beside the
  title and a mono line of tenure (`2020 – 2022`, `2023 – Present`), team and
  location; its prose under both, at the card's full width. The company and
  the handle are not restated: the mark that opened the card printed them,
  and the sheet is titled by the handle.
- **The other roles** under the same identity, latest first, as quiet rows
  with their tenure on the right, under `Also at <company>`.
- **Contributions** as figures: how many commits were signed with this
  handle, then each type, most numerous first (`5 commits · 4 projects ·
  1 talk`). With a single type the total would only repeat it, so the type
  stands alone. In the peek the figures are a readout, a row of tiles. In
  the sheet they are a segmented control one line high (the shared
  `Segmented`, reader tone), the tabs of the signed commits listed under them
  as an inset group, so the count heads the list it counts rather than
  sitting beside a second copy of it. The list's box eases to its new height
  when a tab changes how many rows it holds, and the sheet, sized to its
  content, follows it. A tab opens on All each time the card does.

Everything is derived from the committed log by `buildIdentityProfile`, and
the same `resolveIdentity` the bylines use decides what was signed as whom.
The card cannot say anything the timeline does not.

## A glance, then a press

`/works` has one hover system: the magnetic peek that follows the cursor off
a folded row (`components/motion-primitives/magnetic-preview.tsx`). A name
that stands for more than it prints is the same kind of thing as a row that
holds more than it shows, so on a desktop the card first arrives **as a
peek**: rest the pointer on a handle and the profile comes with it and
leaves with it. `IdentityHover` wraps the mark; `IdentityPeek` derives the
profile only while hovered (`useIdentityProfile`), so nothing is computed for
the rows nobody is looking at.

A peek rides the cursor, so the pointer can never reach it: it is a glance,
not a place. The rest of the card (the figures as tabs, the signed commits,
Visit) is one press away, with any input. The mark is a button everywhere,
and a press opens the identity card as a surface (`ANCHORED_PRESENTATION`: a
sheet on a phone, a popover off the mark from `sm` up), titled by the handle.
The peek says so in its last line (`click to open the card`, `IdentityPeek`'s
`openHint`, passed only by `IdentityHover`) and stands down while the card is
open, so the profile is never printed twice.

Two other hosts reuse the peek and keep their own press: a role row's
unfolds the row, and a magic link's goes to the role's row on `/works`
(with a pointer; under a finger both open the card). Their peeks carry no
hint, since it would promise what the click does not do.

## Triggers

`Byline` (`components/log/bylines.ts`) carries `identityId` and `roleId`, so
a mark needs nothing else:

```tsx
<IdentityHover identityId={byline.identityId} roleId={byline.roleId}>
  {byline.handle}
</IdentityHover>
```

| Where | The mark |
|---|---|
| `/works` row (`TimelineCommit`) | the signature: `<handle>` under the hash on hover (desk), or the `commit` / `Author:` stack a tap on the row's mark, team or date opens (phone), with no `Role:` (the card carries it); **the row itself, for a role**: its row peek is the identity (`buildCommitPreview`), and a tap opens the sheet |
| The author block (`AuthorFields`, shared by `/works` and the home status widget) | the `Author:` and `Role:` lines **together**, as one region (`IdentityHover`'s `block`): they stand for one identity, so the whole block lights on hover and under the finger that opens the sheet, rather than one line of it |

Outside the provider the marks print as plain text, as they did.
