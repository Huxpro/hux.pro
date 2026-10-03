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

## Two ways in, chosen by the input

`/works` has one hover system: the magnetic peek that follows the cursor off
a folded row (`components/motion-primitives/magnetic-preview.tsx`). A name
that stands for more than it prints is the same kind of thing as a row that
holds more than it shows, so on a desktop the card **is a peek**: rest the
pointer on a handle and the profile arrives with it and leaves with it. No
click, no header, no close. `IdentityHover` wraps the mark; `IdentityPeek`
derives the profile only while hovered (`useIdentityProfile`), so nothing is
computed for the rows nobody is looking at.

Where there is no pointer (a phone, a touch tablet), the same mark is a
button and a tap opens the identity card as a surface
(`ANCHORED_PRESENTATION`: a sheet on a phone, a popover off the mark on a
tablet), titled by the handle. `useInputCapability().magneticPreviewEnabled`
is the one switch between the two, so it follows the input rather than the
viewport: an iPad with a trackpad hovers, a touch laptop taps.

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
| `/works` row (`TimelineCommit`) | the `<handle>` on the meta line or at the foot of the contact strip; **the row itself, for a role**: its row peek is the identity (`buildCommitPreview`), and a tap opens the sheet |
| The author block (`AuthorFields`, shared by `/works` and the home status widget) | the `Author:` and `Role:` lines **together**, as one region (`IdentityHover`'s `block`): they stand for one identity, so the whole block lights on hover and under the finger that opens the sheet, rather than one line of it |

Outside the provider the marks print as plain text, as they did.
