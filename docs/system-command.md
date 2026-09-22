# Command System

The command system provides **keyboard-first navigation** through a modal
command palette, inspired by macOS Spotlight, Raycast, and VS Code. It is
dual-purpose: a universal search **and** an **app launcher**.

## Overview

```
systems/command/
├── provider.tsx       # CommandProvider with keyboard shortcuts
├── palette.tsx        # Picks the shell for the viewport: sheet or popover
├── popover.tsx        # The desktop shell — a Spotlight card, draggable
├── sheet.tsx          # The phone shell — a bottom sheet with detents
├── actions.tsx        # The one command list; CommandKind; shell context
├── results.tsx        # cmdk results and the slash list, shared by both shells
├── apps-launcher.tsx  # Spotlight-style horizontal Apps strip
├── load-bundle-panel.tsx  # System UI OTA Lynx bundle form
├── launcher.tsx       # Picks what stands at the bottom: button or tab bar
├── fab.tsx            # Floating action button trigger
├── tab-bar.tsx        # The phone tab bar (devtool: Command → Phone nav)
├── use-devtool-hold.tsx   # The hold on the search button that opens the devtool
└── index.ts           # Barrel exports
```

## Two shells

Which shell is a property of the viewport, decided the way every secondary
surface decides it (`useSurfaceMode`, see [Surfaces](./system-surface.md)):

| Viewport | Shell | Where |
|----------|-------|-------|
| Phone (below `sm`) | **Sheet** — `SurfaceSheet` with detents `[0.7, 1]` | `sheet.tsx` |
| From `sm` up | **Popover** — the centred Spotlight card, draggable | `popover.tsx` |

`palette.tsx` declares `{ base: "sheet", sm: "popover" }` against the surface
system's breakpoints (`useBreakpointValue`), so the palette and the secondary
surfaces change shape at the same widths without the palette pretending to be
an `AdaptiveSurface`.

Both render the same bodies (`results.tsx`) from the same command list
(`actions.tsx`); a shell only decides chrome and how the palette leaves.

### The sheet

The same sheet the wallpaper picker and the playlist are, with the search field
where their title bar is. It opens at seven tenths of the screen; a drag or a
tap into the field carries it to the top, the way Maps' sheet grows when its
search field is tapped, so the keyboard has the most room under it. Dragging it
back down gives the keyboard up again.

A launcher is not a secondary surface, so the sheet is modal: the page stops
answering while it is up, and a tap on the page dismisses it, as a click on the
page dismisses the popover.

**Keyboard hints** — the letters beside rows, `esc`, the footer's arrows —
follow the input device, not the shell: `useShowKeyboardHints()` reads
`hasFineHoverPointer` from `services/input-capability`. A desktop shows them;
so does an iPad with a trackpad (and so a keyboard), live, the moment one is
attached; a phone and a bare iPad do not, in either shell. The popover's own
Safari accommodations are keyed to the *phone* (`/iPhone|iPod/`), not to iOS:
iPad Safari has the room to be treated like a desktop.

**Stacking.** A command that opens a secondary surface — the wallpaper picker —
does not close the palette on a phone. The palette stays and steps back while
the picker rises over it (the surface stack does that; from a sub-mode sheet
the palette steps back two), and closing the picker brings it forward again:
on a phone a sheet presented from a sheet returns to it, as on iOS. Only the
keyboard goes. On the desktop the popover closes, as before.

**Sub-modes as nested sheets.** The palette has two sub-modes, mutually
exclusive (`isSlashCommandsMode` / `isLoadBundleMode` in `provider.tsx`): the
slash list and the load-bundle form. Each is a task inside the palette that
returns to the palette when it is done, so on a phone each is a second sheet
stacked on the palette, the way iOS presents a sheet from a sheet — never a
body swapped in underneath, which is what the popover does and what the sheet
used to do for load bundle.

| Sub-mode | Sheet | Height | Reached by | Leaves by |
|----------|-------|--------|------------|-----------|
| Slash commands | `command-slash` | level with the palette's detent | the `/` chip, or `/` in the empty field | close, drag down, tap the palette, a command |
| Load bundle | `command-bundle` | its content (`fitContent`) | the apps strip's Load tile (`openLoadBundle()`) | close, drag down, tap the palette, Open |

Both headers are the same shape: an icon, the title, and one way out one level
down.

Both behave the same way in the stack, and that is the point: the palette stays
open and steps back (the surface stack does that), the sub-mode rises over it,
and a drag down — the palette coming forward under the finger — its close
button or a tap on the receded palette brings the palette forward again, one
level at a time as on iOS: the palette's own close stays on the palette.
Neither returns focus on close (`restoreFocus={false}`): focus handed back to
the search field is a focused field with no keyboard, and iOS opens the
keyboard on the next touch anywhere. Neither has detents of its own: Base UI
reports a sheet with detents' swipe as a position between them, which at the
lowest detent is already all the way, and the palette needs the plain fraction
of the way out. Both are React children of the palette's sheet, so Base UI
treats them as nested and disables the parent's own swipe while one is up.
Escape pops one sheet at a time, as it does on an iOS stack.

Each takes the height its own content asks for, which is not the same height.
The slash list stands level with the palette's detent
(`detentHeight(detent)` + `level={detent}`, read once on the way in), with the
palette's top edge peeking above: a list picks up where the palette's list left
off. The bundle form takes the height of a hint, a field and a button and no
more (`fitContent` on `SurfaceSheet`) — a sheet up to the palette's detent to
hold one field would be mostly empty — and grows a line when the invalid-URL
message appears. It is the one sub-mode with a field of its own, so the keyboard
comes back for it: the sheet rests on top of the keyboard rather than behind it
(`--drawer-keyboard-inset`, handled once in `SurfaceSheet` by Base UI's
`VirtualKeyboardProvider`) while the palette's search field sits blurred
underneath. `LoadBundlePanel` takes a `chrome` prop for the two shells:
`"panel"` brings its own back arrow and title for the popover, `"sheet"` drops
both because the sheet header already carries them.

The slash chip is the hint made pressable: the same kbd vocabulary with a rim
and a touch-sized hit area, inside the field where iOS keeps a search field's
accessory (and so apart from the close button outside it), shown only while the
field is empty, which is exactly when typing `/` would have worked. In the
popover the same slot shows `esc` with a keyboard and the chip without one. The
field gives up the keyboard as either sub-mode comes in; a hardware keyboard
still gets the slash letters.

### The popover

The palette as it was: a centred card a fifth of the way down, morphing between
its three modes in place — the sub-modes replace its body rather than stacking
on it, because a popover has no stack — draggable through the shared hook,
closed by a click on the page. It keeps its iOS Safari accommodations (scroll position pinned while up,
no autofocus so the keyboard does not jump the layout) because the devtool can
still ask for it on a phone — the Command module's **Phone palette** row, a
saved setting, switches Sheet ↔ Popover. That is one presentation map, not a
second code path: the popover never stopped working at phone width.

The popover search list grows with the viewport (`43dvh`, capped at `40rem`)
instead of a fixed `360px` — Geolocation is the last full row on a 16" laptop.
Slash commands skip that cap so the card grows taller as it morphs, the way
it used to. It also sits a little lower (`22vh`, capped at `13.5rem`). The
sheet does not use this: it fills whichever detent it is on.

### Commands

`useCommandActions()` is the one list behind search results, the slash list and
the slash letters. Each command carries its `kind`, which decides what the
palette does after it runs:

| Kind | Does | After, from search | After, from the slash list |
|------|------|--------------------|----------------------------|
| `navigate` | goes somewhere | closes | closes |
| `surface` | opens a secondary surface | popover closes; sheet stays behind it | same |
| `toggle` | flips a setting | stays, so the new value reads back | closes |

`useRunCommand()(action, origin)` holds that table, with `origin` being
`"search"` or `"slash"`; the shell supplies `leave(kind)` through
`useCommandShell()`, and the lists never call `close` themselves.

## The phone tab bar

A second shape for the trigger, off by default and chosen in the devtool
(Command → **Phone nav**: Button / Tabs). Below `md` it replaces the floating
button with a capsule of five: **Home · Writing · Search · Works · Prompts**,
the palette itself in the middle where a thumb already is. Tapping Search opens
the same drawer the button always did — this changes what stands in front of
the palette, not the palette. A desktop is untouched whatever the switch says.

It is a proposal, which is why it is a devtool switch and not a setting: the
palette is still how this site is navigated, and four tabs are a claim about
which four places matter. The tabs carry the same glyphs as the palette's own
navigation rows (`actions.tsx`), because a tab and its row are one destination
and must not look like two.

**The selected pill** is one absolutely-positioned span that animates `x` by
whole multiples of its own width. Five `flex-1` tabs are exactly a fifth of the
track each, so it needs no measuring, no `ResizeObserver` and no state — the
active index *is* the animation. Not `layoutId`: a shared-element projection
re-runs whenever anything else in the bar moves, and the shrink below moves the
bar on every scroll, so the pill would trail it rather than sit in it. On an
unlisted route (`/docs`, `/editor`) the pill parks under the palette and fades,
rather than picking a tab that is not on.

**The scroll shrink** is the bar stepping back from a page in motion, as iOS 26
does with Safari's tab bar: scrolling down takes it to 0.86, and it comes back
the moment the page settles (`SETTLE_MS`) or turns around. Two states with a
transition, never scroll-linked — a scale that follows the finger re-blurs a
`backdrop-blur` surface on every frame. It is a transform on the whole bar, so
the shrink costs no layout, and it is anchored `bottom center`, so the gap
under the bar stays the gap. `prefers-reduced-motion` turns it off; the state
is published as `data-shrunk` for the inspector and for tests.

Two things it keeps from the button it replaces: the home grid's jiggle mode
still takes the bottom of the screen (the bar hands it over on `HANDOFF`), and
holding Search for 1.2s still summons the devtool — the same hook, the same
ring (see [Devtool](./system-devtool.md) → The hidden one). It is not
draggable: `command-fab` is an instance for a floating button, and a bar that
spans the width has nowhere to go.

## Key Features

### Dual Modes

1. **Search Mode**: Fuzzy search across navigation, settings, content, and apps
2. **Slash Commands**: Single-key shortcuts for quick actions

### App launcher (Spotlight-style)

When the Window system is mounted, ⌘K also launches apps from
`content/apps.json` via a headerless **horizontal icon strip**
(`systems/command/apps-launcher.tsx`):

- Same presentation for browse and search — cmdk filters icons in place
- Strip scrolls horizontally when the catalog overflows
- Group hides entirely when no app matches the query
- Real snapshot tiles via shared `AppTile` (`md` / 48px). Below Tailwind `md`
  the column pitch is ~5.3-wide so iPhone 16 Pro shows five icons plus a
  sliver of the sixth
- The strip lists the **full catalog**, including `featured: false`
  command-only apps (BusyWeek, Cat Wand / 逗猫棒) that the home folder omits

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Toggle command palette |
| `/` | Open in slash commands mode |
| `Esc` | Close palette |
| `Backspace` | Exit slash commands mode |

### Slash Commands Shortcuts

| Key | Action |
|-----|--------|
| `H` | Go to Home |
| `U` | Go to Writing |
| `X` | Go to Works |
| `I` | Go to Docs (internal) |
| `A` | Toggle appearance |
| `L` | Toggle language |
| `G` | Toggle geolocation |
| `W` | Open the Wallpaper picker |
| `G` | Toggle Glass material |
| `T` | Toggle glass Tint |
| `M` | Play / pause Music |
| `D` | Toggle devtool FAB |

## Components

### CommandPalette

The main palette component using [cmdk](https://cmdk.paco.me/):

```tsx
<CommandPalette />
```

Features:
- Search across all navigation targets
- Settings quick actions
- Blog posts search
- Apps launcher with real app icons (grid + list)
- Bilingual search (EN/中文 keywords)
- Adaptive popover height: search `43dvh`, slash taller (viewport chrome only)

### CommandLauncher

What stands at the bottom of the screen and opens the palette. Mounted once in
the root layout, and it picks one of two shapes the way `palette.tsx` picks a
shell — the button, or (on a phone, behind the devtool switch) the tab bar.

```tsx
<CommandLauncher />
```

### FloatingActionButton

Context-aware FAB that morphs based on route:

- **Homepage**: Search bar with placeholder
- **Other pages**: Compact command button

## Hooks

### useCommand

```typescript
const {
  isOpen,
  isSlashCommandsMode,
  open,
  close,
  toggle,
  setSlashCommandsMode,
} = useCommand();
```

## Searchable Content

The palette searches across:

1. **Apps**: Horizontal icon strip (filtered in place; hidden when no match)
2. **Navigation**: Home, Writing, Works, Docs
3. **Settings**: Appearance, Language, Location, Gradient, Music, Devtool
4. **Blog Posts**: Title, description, tags (both languages)

## iOS Compatibility

On a phone the palette is a sheet, and the keyboard is the sheet primitive's
problem: every `<SurfaceSheet>` is wrapped in Base UI's
`Drawer.VirtualKeyboardProvider`, which measures the software keyboard and
publishes `--drawer-keyboard-inset`, and the glass shell takes that as a bottom
margin so the palette rests on the keyboard rather than behind it. The field is
16px so Safari does not zoom on focus. The field is not focused on open; a tap
into it is the signal, and it carries the sheet to the top detent as the
keyboard comes up. Dragging back down blurs it, so the lower detent is not half
hidden behind a keyboard. Both of those are here, in `sheet.tsx`, not in the
primitive: where a palette wants to sit is a palette's business.

The popover keeps its own accommodations for when the devtool puts it on a
phone: scroll position pinned while it is up, no autofocus so the keyboard does
not jump the layout, and a backdrop that dismisses on touch.
