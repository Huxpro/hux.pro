---
name: base-ui-drawer
description: The contract hux.pro's sheets and Dock panel rely on in Base UI's Drawer. Use before editing systems/surface/sheet.tsx, stack.ts, systems/dock/components/live-activity.tsx, or the "Secondary surface motion" / "Dock panel motion" blocks in app/globals.css, and when debugging a sheet's swipe, detents, stacking, exit animation or focus.
---

# Base UI Drawer

Base UI (pinned 1.8.0) hands every visual to CSS and publishes state as data
attributes and custom properties. Their meaning lives in its docs and source
(`node_modules/@base-ui/react/drawer/{popup,viewport}/*.js`), not in its
types. Every rule below was a bug that shipped and was reverted.

The full list, with the reasoning, is the "BEFORE CHANGING THIS FILE" block
at the top of `systems/surface/sheet.tsx` (items 1–10) and of
`live-activity.tsx` (five more for the drawer travelling `up`). Read the one
you are touching. The headlines:

- `--drawer-swipe-progress` is the fraction out without snap points, but the
  position *between* detents with them. A sheet whose parent follows its
  swipe cannot have detents.
- The swipe variables are registered `inherits: false`; a descendant needs
  `--name: inherit`.
- An exit ends when `popup.getAnimations()` is empty a frame after
  `data-ending-style`. Never `transition: none` on that frame: drop the
  duration, keep the property.
- Nesting is React nesting. Sheets in sibling subtrees go through
  `stack.ts`; a nested one says `nestedIn`.
- Once a press becomes a swipe the popup captures the pointer: no move, up
  or click arrives. Hold no state the end of a gesture must clear.
- A swipe never starts on `button,a,input,select,textarea,label,[role=button]`;
  content below the grabber goes in `Drawer.Content`.
- Up drawer (Dock): opacity on the glass itself, never an ancestor (it kills
  the blur); the closed transform may scale, never translate; no snap points.

Testing: a `.click()`, a touch tap, a swipe release and a programmatic
`focus()` are four different paths. Test the one users take.

More: `docs/system-surface.md` ("The sheet primitive", "Working with Base
UI", "Stacking"), `docs/system-dock.md`.
