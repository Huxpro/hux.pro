---
skills: [keyboard-input]
---

# Typing on a phone

How a field on this site meets the software keyboard: what makes Ask's
composer rest on the keyboard while its glass shrinks to fit, which parts of
that are load-bearing, which are choices, and where every field on the site
stands.

## What it looks like done well

Ask on a phone (`systems/ask/surfaces.tsx`, the `ask` sheet):

- The field rests on the keyboard, the same gap above it as the glass has
  from the sides. Nothing hides behind the keyboard and nothing floats.
- The glass shrinks from the bottom as the keyboard rises and grows back as
  it falls, on the surface curve. Its top edge, its grabber and its title
  bar never move.
- The conversation keeps the space between: it scrolls, it is not pushed
  off the top.
- The page does not zoom, scroll or jump underneath.
- The composer is held off the glass by one padding on every side (8px):
  the home indicator is the shell's business, not the field's.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/keyboard-input/ask-keyboard-down.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="Ask on a phone with the keyboard down: the sheet stands full height, the composer at its bottom." />
  <img src="/img/docs/keyboard-input/ask-keyboard-up.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The same sheet on an iPhone with the keyboard up: the top edge, grabber and title bar have not moved; the glass ends just above Safari's accessory bar, and the composer rests there." />
</div>

Keyboard down (headless, 393pt wide) and up (an iPhone in Safari). The top
edge has not moved; the glass got shorter, and the suggestions gave up the
height.

## How it works

Five pieces, each in one place.

![The popup stays one height; the shell inside it takes the keyboard's height as a bottom margin and shrinks from the bottom, the content giving up the room and the field resting on the keyboard.](/img/docs/keyboard-input/layers.svg)

1. **The measurement.** Every `SurfaceSheet` (`systems/surface/sheet.tsx`)
   is wrapped in Base UI's `Drawer.VirtualKeyboardProvider`. It watches
   `visualViewport` (`resize`, `scroll`) and focus, and while a
   keyboard-type field *inside that drawer* is focused it publishes
   `--drawer-keyboard-inset` on the drawer's viewport:
   `innerHeight - (visualViewport.offsetTop + visualViewport.height)`, the
   whole band the keyboard (and Safari's accessory bar) takes. Otherwise 0.
   Source: `node_modules/@base-ui/react/drawer/virtual-keyboard-provider/`.
2. **The shape.** `[data-surface-shell]` takes that inset as its
   `margin-bottom`, transitioned on `--surface-duration` /
   `--surface-easing` (`app/globals.css`, "Secondary surface motion").
3. **Why it shrinks instead of rising.** The popup has a fixed height (a
   detent, or `height` such as `detentHeight(1)`), and the shell is its
   `flex-1` child. A bottom margin on a flex child of a fixed box takes the
   height out of the child: the glass gets shorter, its top stays. A
   `fitContent` sheet is `flex: 0 1 auto` instead, so the same margin lifts
   it whole: the form rides up on the keyboard (the bundle sheet).
4. **The layout inside.** `SurfaceBody` (`systems/surface/chrome.tsx`) is a
   column: header `shrink-0`, content `flex-1 overflow-y-auto`, footer
   `shrink-0`. The field lives in the footer, so it is the last thing above
   the shell's bottom edge, and the content is what gives up height.
5. **A field inside the scroller.** For a field that sits in the scrolling
   content rather than the footer (editing a sent question,
   `systems/ask/components/messages.tsx`), the provider scrolls the nearest
   scrollable ancestor so the field is centred in the band above the
   keyboard, with temporary `padding-bottom` / `scroll-padding-bottom` to
   make room. Nothing of ours does that.

## Constraints

Each of these, broken, has a visible failure.

| Constraint | Why | What breaks |
|---|---|---|
| The field is inside a `SurfaceSheet` | The provider only measures for focus within its own drawer | No inset: the field sits behind the keyboard |
| The field is a keyboard type: `textarea`, or `input` of type text, search, email, url, password, number, tel (or none) | The provider's own test for "a keyboard is up for this" | No inset for the others; they bring no keyboard anyway |
| Font size at least 16px on a phone (`text-[16px] sm:text-sm`) | iOS Safari zooms the page on focus below 16px, and the provider gives up while `visualViewport.scale !== 1` | Zoomed page, then no inset |
| The popup has a fixed height and the shell is `flex-1` (or the sheet is `fitContent`) | That is what turns a bottom margin into a shrink (or a lift) | A shell with an intrinsic height grows past the screen instead |
| Inside the shell, a column: content `min-h-0 flex-1` scrolling, field `shrink-0` after it | The content is what gives up height | Without `min-h-0` the content refuses to shrink and the field is pushed under the keyboard |
| No `env(safe-area-inset-bottom)` inside a shell, and no `visualViewport` arithmetic of your own | The shell already stands above the home indicator (`BOTTOM_INSET`) and above the keyboard (the inset); counted again it is a gap (the composer had ~34px under it against 8px at its sides) | Double gaps, or a field that jumps as two measurements disagree |
| A sheet stacked on a sheet with a field sets `restoreFocus={false}` | Focus handed back to a field on iOS is a focused field with no keyboard, and the next touch anywhere opens one | A keyboard out of nowhere after closing a sheet |
| Don't fight the provider's scroll: no `scrollIntoView` on focus, no `position: fixed` field inside a sheet | It already brings the field into view, and owns the window scroll for a modal drawer | Two scrolls racing; the page moves under the sheet |
| Leave `app/layout.tsx`'s viewport as is (no `interactive-widget`) | `resizes-visual`, iOS's only behaviour and the default, is what the measurement assumes: the layout viewport keeps its height and `visualViewport` shrinks | A layout viewport that resizes moves `100dvh` and the inset at once |

## What is free to choose

- **Height model.** Detents (`snapPoints={SHEET_DETENTS}`), one fixed
  height (`height={detentHeight(1)}`, Ask), or `fitContent` (a short form).
  The first two shrink, the last lifts.
- **Whether focusing grows the sheet.** The palette climbs to its top
  detent on a tap into the field (`onFieldTap` in
  `systems/command/sheet.tsx`); Ask is already full height.
- **What a drag does to the keyboard.** The palette blurs its field when
  dragged below the top detent; another sheet may keep it.
- **Padding.** Whatever the design wants, as long as it is the same idea on
  every side and none of it is the home indicator.
- **Modal or not.** A modal sheet also pins the window's scroll for the
  length of the keyboard; Ask is non-modal and does not need it.
- **The motion.** `--surface-duration` / `--surface-easing` are the site's
  curve; the keyboard's own animation is the system's and cannot be read.
- **Where the field sits.** In the footer (a composer, a search), in the
  header (the palette's field is its header), or in the content (an inline
  edit). Only the footer and header stay put without scrolling.

## Recipes

A composer at the bottom of a sheet:

```tsx
<SurfaceSheet id="…" open={open} onOpenChange={…} height={detentHeight(1)} restoreFocus={false}>
  <SurfaceBody
    title="…"
    contentClassName="flex min-h-0 flex-col overflow-hidden"
    footer={<div className="p-2 pt-0">{/* the field, text-[16px] sm:text-sm */}</div>}
  >
    {/* the list, min-h-0 flex-1 overflow-y-auto */}
  </SurfaceBody>
</SurfaceSheet>
```

A short form: `fitContent` on the sheet, the form's own scroll area
`min-h-0 overflow-y-auto` (the bundle sheet in `systems/command/sheet.tsx`).

A field outside any sheet:

- In the page's own flow (a lab panel): nothing to do but the font size.
  The browser scrolls a focused field into view.
- Pinned to the bottom of the screen outside a sheet: don't. If a surface
  must be (the Dock's top-anchored Ask panel), size it from
  `visualViewport.height` the way `systems/ask/components/activity.tsx`
  publishes `--ask-viewport`, and test it with the keyboard up.

## Checking a field

1. Phone width, 16px or more (`text-[16px] sm:…`)?
2. Inside a `SurfaceSheet`, or in page flow? Anything else is a finding.
3. Sheet: fixed height or `fitContent`; inside, `min-h-0 flex-1` content
   and a `shrink-0` field?
4. No `env(safe-area-inset-bottom)` / `visualViewport` / `scrollIntoView`
   added around it inside a sheet?
5. Sheets stacked over it set `restoreFocus={false}`?
6. On a device (Playwright cannot raise an iOS keyboard): tap the field,
   watch the top edge stay and the gap above the keyboard match the sides;
   type, scroll the content, drag the sheet, dismiss the keyboard.

## Every field on the site

As of the audit that wrote this page (2026-10).

| Field | Where on a phone | Status |
|---|---|---|
| Palette search, `systems/command/sheet.tsx` | `command` sheet, detents, field in the header | Good; climbs to the top detent on tap |
| Palette search, `systems/command/popover.tsx` | Desk only (a phone gets it only from the devtool) | Out of scope; 16px on a phone regardless |
| Load bundle URL, `systems/command/load-bundle-panel.tsx` | `command-bundle` sheet, `fitContent`, stacked | Good; was 13px, now 16px on a phone |
| Ask composer, `systems/ask/components/composer.tsx` | `ask` sheet, footer | The reference |
| Ask context search, same file | Same sheet, above the composer | Good; was 14px, now 16px on a phone |
| Ask edit-a-question, `systems/ask/components/messages.tsx` | Same sheet, in the scroller | Good; the provider scrolls it into view |
| Ask in the Dock, `systems/ask/components/activity.tsx` | Not on a phone by default (preset) | Sized from `--ask-viewport`, no provider |
| Lab text field, colour hex, `systems/lab/components/controls.tsx` | `/lab/icon`, page flow | Good; were 14px / 12px, now 16px on a phone |
| Lab API filter, `systems/lab/components/library.tsx` | `/lab/vitre/api`, sticky bar in page flow | Good; was 12px, now 16px on a phone |
| Works editor, tag editor, `app/lab/works/` | Desk only (inspector off under 1024px) | Out of scope |
| Legibility export, `app/lab/legibility/view.tsx` | Read-only, no keyboard | Out of scope |

## Open

- **The gap above the keyboard in a Home Screen app.** The shell rests
  `max(env(safe-area-inset-bottom), 12px)` above the screen's bottom, and
  the keyboard inset is added on top of that. In Safari the inset is small
  and the gap matches the sides. In an app added to the Home Screen the home
  indicator's 34px stays in `env()` while the keyboard covers it, so the
  glass would stand ~34px above the keyboard against 12px at its sides. A
  candidate, untested on a device:
  `margin-bottom: max(0px, var(--drawer-keyboard-inset, 0px) - (max(env(safe-area-inset-bottom), var(--surface-gap)) - var(--surface-gap)))`.
