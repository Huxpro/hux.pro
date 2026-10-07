---
name: keyboard-input
description: Make a text field on hux.pro behave on a phone the way Ask's composer does - resting on the software keyboard while its sheet's glass shrinks to fit, no zoom, no double gaps. Use when adding or changing any <input>, <textarea>, cmdk input or composer, when a sheet or surface gains a field, when touching keyboard / safe-area / visualViewport / dvh code, or when asked to audit or fix how inputs meet the keyboard on mobile.
---

# Keyboard input on a phone

The full reasoning, the constraints table and the site's inventory are in
`docs/keyboard-input.md`. Read it before changing anything in
`systems/surface/sheet.tsx` or the "Secondary surface motion" block of
`app/globals.css`, and read the "BEFORE CHANGING THIS FILE" list at the top
of `sheet.tsx` too.

## The mechanism, in one breath

`SurfaceSheet` wraps every sheet in Base UI's `Drawer.VirtualKeyboardProvider`,
which publishes `--drawer-keyboard-inset` while a field inside that drawer is
focused. `[data-surface-shell]` takes it as a transitioned `margin-bottom`.
The popup has a fixed height and the shell is `flex-1`, so the glass shrinks
from the bottom (a `fitContent` sheet rises whole instead). Inside,
`SurfaceBody` is header / `flex-1` scrolling content / `shrink-0` footer, and
the field lives in the footer.

## Doing it

For a new field, or one being changed:

1. **Host it in a `SurfaceSheet`** (directly or through `AdaptiveSurface`) on
   a phone, or leave it in normal page flow. A field in anything else that
   is pinned to the bottom of the screen is a finding.
2. **16px on a phone**: `text-[16px] sm:<desk size>`. Below 16px iOS zooms on
   focus, and the provider stops measuring while the page is zoomed.
3. **Sheet height**: detents or a fixed `height` to shrink, `fitContent` to
   lift. Never an intrinsic height with a field at the bottom.
4. **Layout**: the content `min-h-0 flex-1 overflow-y-auto`, the field
   `shrink-0` after it (`SurfaceBody`'s `footer`). One padding on every side
   of the field; never `env(safe-area-inset-bottom)` inside a shell.
5. **Add nothing of your own** around it inside a sheet: no `visualViewport`
   math, no `scrollIntoView` on focus, no `position: fixed`.
6. **Stacking**: any sheet that opens over a sheet with a field passes
   `restoreFocus={false}`.
7. **Update the inventory** table in `docs/keyboard-input.md`.

## Auditing and verifying

Find every typing site (`rg -n "<input|<textarea|Command\.Input|PromptInputTextarea"`,
skipping checkbox, radio, range, color, file), trace each to its phone host,
check it against the steps above, fix, and update the inventory table.

Lint, `tsc` and Playwright can't raise an iOS keyboard. Say so, and ask for
a check on a device: tap the field (top edge stays, the gap above the
keyboard matches the sides), type, scroll, drag, dismiss, and close a sheet
stacked on it (no keyboard comes back on its own).
