# Identity System

Who I was when I committed this.

```
systems/identity/
├── provider.tsx                  # IdentityCardProvider, useIdentityCard() — open / close
├── lib/profile.ts                # buildIdentityProfile(log, identityId, roleId, locale)
└── components/identity-card.tsx  # the card (AdaptiveSurface, ANCHORED_PRESENTATION)
```

## The problem

Every commit on `/works` is signed by an identity — `<jsx@fb.com>`,
`<@bytedance>`, `<rit.edu>` — and each identity holds one or more roles: the
two Meta summers and the full-time years are three roles under one handle.
The row's `Role:` field used to open the role's two lines of prose in place,
and that was all a role could say. The rest of what the log knows about a
tenure — its dates, its location, its team, the other roles under the same
handle, what was signed with it — had no surface.

## The card

Pressing a `<handle>`, a `Role:` field, or a role row itself opens the
identity's card: a GitHub profile page sized to a card.

- **The header** a profile opens with: a photo from that time masked to a
  circle (`Identity.avatar` in `content/log.json`, a site-local path or URL;
  a monogram of the company on the era's accent stands in until one is
  authored), the company, the handle, and the era it belongs to.
- **The role** the card was opened at — title, tenure (`2020 – 2022`,
  `2023 – Present`), team, location — and its prose.
- **The other roles** under the same identity, latest first.
- **Contributions**: how many commits were signed with this handle, by type,
  most numerous first (`7 commits signed · 4 projects · 3 talks`).
- **Actions**, in the theater's glass chrome: `View in log` (the latest commit
  signed as this identity, by address) and the company's site.

Everything is derived from the committed log by `buildIdentityProfile` —
the same `resolveIdentity` the bylines use decides what was signed as whom —
so the card cannot say anything the timeline does not.

## Shape

`ANCHORED_PRESENTATION`, the reading settings' shape: a sheet on a phone (the
drawer a name opens in any app), and from `sm` up a popover hanging off the
element that was pressed — GitHub's hovercard for a name. Triggers pass the
pressed element as `anchor`; the provider keeps it in a ref the popover
positions against. `fitContent` in both shapes.

## Triggers

`Byline` (`components/log/bylines.ts`) now carries `identityId` and `roleId`,
so a row needs nothing else:

```tsx
const card = useOptionalIdentityCard();
card?.open({ identityId: byline.identityId, roleId: byline.roleId, anchor: e.currentTarget });
```

| Where | What opens it |
|---|---|
| `/works` row (`TimelineCommit`) | the `<handle>` mark on the meta line or the media line; the `Author:` and `Role:` fields in the expanded body; **the row itself, for a role** — a role row is nothing but its identity |
| Home status widget (`TimelineMini`) | the `Author:` and `Role:` fields |

Outside the provider the fields print as plain text, as they did.
