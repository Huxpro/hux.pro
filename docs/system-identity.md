# Identity System

Who I was when I committed this.

Every commit on `/works` is signed by an identity (`<jsx@fb.com>`,
`<@bytedance>`, `<rit.edu>`), and each identity holds one or more roles: the
two Meta summers and the full-time years are three roles under one handle.
A handle, a `Role:` field or a role row stands for the identity's card: a
GitHub profile page sized to a card, the role it was opened at, the other
roles under the same handle, and what was signed with it.

```
systems/identity/
├── index.ts               # the public exports
├── provider.tsx           # IdentityCardProvider, useIdentityCard, useIdentityProfile
├── lib/profile.ts         # buildIdentityProfile(log, identityId, roleId, locale)
└── components/
    ├── identity-profile.tsx  # IdentityProfileView: the card's contents
    ├── identity-hover.tsx    # IdentityHover / IdentityPeek: the hover peek
    └── identity-card.tsx     # IdentityCard: the surface a finger opens
```

`IdentityCardProvider` is mounted in `shared/providers.tsx`, and
`<IdentityCard />` once in `app/layout.tsx`.

## What it looks like

![A /works row on a desk: the pointer rests on the handle jsx@fb.com under the row's hash, and a card has followed it out: a photo beside "Software Engineer, 2020 – 2022", the role's prose, "Also at Meta" with the two internships, and a row of figures: 5 commits, 4 projects, 1 talk.](/img/docs/system-identity/desk-peek.png)

With a pointer the card is a peek. Rest it on a `<handle>` and the profile
arrives with it and leaves with it. There is nothing to press, and the
figures are a readout.

<img src="/img/docs/system-identity/phone-sheet.png" style={{ width: "min(100%, 320px)" }} alt="The same identity on a phone, as a sheet titled <jsx@fb.com>: the same head, prose and other roles, then the figures as a segmented control (5 commits, 4 projects, 1 talk) over the five signed commits, and a Visit button." />

With a finger the same card is a sheet, titled by the handle. Its figures are
tabs over the commits they count, each a row to open, and Visit goes to the
role's row on `/works`. Headless, 393pt wide, opened by a tap on the Meta
role row.

## The card

- **The role** the card was opened at, laid out as a profile page's head: a
  photo from that time, masked to a circle, beside the title and a mono line
  of tenure (`2020 – 2022`, `2023 – Present`), team and location; its prose
  under both, at the card's full width. The photo is
  `identities.<id>.avatar` in `content/log.json` (a site-local path or URL).
  No identity has one yet, so every card shows the GitHub avatar,
  `DEFAULT_AVATAR` in `lib/profile.ts`. The company and the handle are not
  restated: the mark that opened the card printed them, and the sheet is
  titled by the handle.
- **The other roles** under the same identity, latest first, as quiet rows
  with their tenure on the right, under `Also at <company>`.
- **Contributions** as figures: how many commits were signed with this
  handle, then each type, most numerous first (`5 commits · 4 projects ·
  1 talk`). With a single type the total would only repeat it, so the type
  stands alone. In the peek the figures are a row of tiles. In the sheet
  they are a segmented control one line high (the shared `Segmented`, reader
  tone), the tabs of the signed commits listed under them as an inset group,
  so the count heads the list it counts. The list's box (`EasedHeight`)
  eases to its new height when a tab changes how many rows it holds, and
  the sheet, sized to its content (`fitContent`), follows it. A card opens
  on All.
- **In the sheet only**: a commit row opens its attachments in the
  attachments drawer, stacked over this one, when the drawer is their home
  (`attachments.homeOf(set, 0) === "surface"`); otherwise it goes to the
  commit's row on `/works`. **Visit** goes to the role's row.

### Where the data comes from

All of it is derived from the committed log by `buildIdentityProfile`, read
through `LOG` (`lib/log-client.ts`):

- The identity is `identities.<id>` in `content/log.json`: `handle`,
  `company`, `avatar`, `accentColor`.
- Its roles are that identity's `ranges[]`. `normalizeLogData`
  (`lib/log.ts`) turns each range into a `role` commit with `identityId`
  set, which is what the timeline renders as a role row too.
- What was signed as whom is `resolveIdentity` (`lib/log.ts`), the same
  function the bylines use: an explicit `identityId` on the commit, else the
  role it is `attachedTo`, else the role whose tenure covers its date; a
  commit with `attachedTo: null` and no `identityId` is signed by no one.
  Roles and events are not counted, nor commits the locale does not list.

The card cannot say anything the timeline does not.

## Two ways in, chosen by the input

`/works` has one hover system: the magnetic peek that follows the cursor off
a folded row (`components/motion-primitives/magnetic-preview.tsx`). A name
that stands for more than it prints is the same kind of thing as a row that
holds more than it shows, so with a pointer the card **is a peek**.
`IdentityHover` wraps the mark in a `MagneticPreview`; `IdentityPeek`
derives the profile only while hovered (`useIdentityProfile`), so nothing is
computed for the rows nobody is looking at.

Where there is no pointer, the same mark is a button, and a tap calls
`open({ identityId, roleId, anchor })` on the provider. `IdentityCard` is an
`AdaptiveSurface` on `ANCHORED_PRESENTATION`: a sheet below 640px, a popover
hanging off the tapped mark from 640px (a touch tablet). That presentation
belongs to the surface system; see
[Surface System](./system-surface.md).

`useInputCapability().magneticPreviewEnabled` (`services/input-capability.tsx`)
is the one switch between the two. It is true when the primary input is a
mouse, when any fine pointer can hover (`(any-hover: hover)` and
`(any-pointer: fine)`), or once a mouse pointer event has been seen. So it
follows the input rather than the viewport: an iPad with a trackpad hovers,
and so does a touch-screen laptop, since it has a trackpad. With a pointer
the card never opens.

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
| `/works` row signature (`TimelineCommit`) | on a desk, the `<handle>` under the hash on hover; on a phone, the `commit` / `Author:` stack a tap on the row's mark, team or date opens, with no `Role:` (the card carries it) |
| The author block (`AuthorFields`, `components/log/embeds/shared.tsx`), printed in the feed form | the `Author:` and `Role:` lines **together**, as one region (`IdentityHover`'s `block`): they stand for one identity, so the whole block lights on hover and under the finger, rather than one line of it |
| A role row | the row itself: its peek is the identity (`buildCommitPreview` in `components/log/commit-embed.tsx`), and a tap opens the card (`TimelineCommit`'s `openIdentity`) |
| A magic link naming a role or identity (`<Badge role="meta-engineer">`, `components/magic-link/`) | peeks the profile with a pointer, where a press goes to the role's row; a tap opens the card, over the About when it was opened from there (`useOverAboutZ`). See [About System](./system-about.md) |

Outside the provider the marks print as plain text.
