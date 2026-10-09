---
name: attachments
description: Where a commit's media opens on hux.pro (the attachment sheet, the theater, the in-app browser window, the router, a tab) and the chip its cover wears. Use when adding a media kind, a new place that draws a commit's covers or players, changing what a tap on a cover does, or touching systems/attachments, components/log/media/media-mark.tsx or /lab/attachments.
---

# Attachments

- **One door.** A cover, card or player that belongs to a commit calls
  `open(set, set.items.indexOf(media))` from `useOptionalAttachments()`;
  the feed's grid calls `act` instead. Never `window.open`, `openUrl`,
  `openMedia` or `router.push` from a cover: `homeFor` / `nativeHomeFor`
  (`systems/attachments/lib/policy.ts`) decide, and the provider's `send`
  performs. The index is found by reference, so pass the commit's own
  media objects, not copies.
- **Keep the `href`.** Every affordance stays a real `<a>` and returns early
  on a modified click (⌘, ctrl, shift, alt, middle) so the browser keeps it.
- **Chips.** Only `MediaMark` draws one, from `markFor(media, locale, { all,
  leaves })`. The chip says what the thing is, never where it opens. Tiers:
  /works marks a recording, a deck and a page that leaves; the hover peek
  marks every kind (`all`); the sheet's page, home widgets and the theater
  rail mark nothing. `leaves` comes from `homeOf(set, i) === "tab"`.

## Adding a kind

1. `lib/log.ts`: the `Media` union and its `is…Media` guard.
2. `policy.ts`: both `nativeHomeFor` and `homeFor`.
3. `provider.tsx` `send`: the `theater` and `lightbox` cases guard on
   `media.kind`; a new playable or still kind must pass them.
4. `media-mark.tsx`: `mediaKindOf` and `markFor`.
5. `attachment-page.tsx`: a branch, or the sheet renders nothing for it.
6. Plays on the stage: a `Track` kind and `mediaToTrack`
   (`systems/theater/lib/albums.ts`).
7. A new render surface or kind: a row in `RENDER_PATHS`
   (`app/lab/attachments/paths.ts`) and a specimen in the lab.
8. Paints a cover: `pnpm og:complete` (CI) must still pass.

Check it in `/lab/attachments` with the viewport pinned to phone and to
sm-and-up, and with a real tap on a phone-sized page (`hasTouch`).

More: `docs/system-attachments.md`.
