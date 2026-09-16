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
├── fab.tsx            # Floating action button trigger
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

**Hand-off.** A command that opens a secondary surface — the wallpaper picker —
does not simply close the palette on a phone. The sheet stays and steps back
while the picker rises over it (the surface stack does that: smaller, dimmer,
inert), and once the picker has landed, the sheet goes. Closing the picker then
returns to the page, not to the palette: a launcher is finished the moment it
has launched something. On the desktop the popover just closes, as before.

**Slash commands** on a phone are the same list, as rows with a back arrow,
reached by typing `/` into the empty field. The field gives up the keyboard as
the list comes in; a hardware keyboard still gets the letters.

### The popover

The palette as it was: a centred card a fifth of the way down, morphing between
its three modes, draggable through the shared hook, closed by a click on the
page. It keeps its iOS Safari accommodations (scroll position pinned while up,
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
| `surface` | opens a secondary surface | closes (sheet: hands off) | same |
| `toggle` | flips a setting | stays, so the new value reads back | closes |

`useRunCommand()(action, origin)` holds that table, with `origin` being
`"search"` or `"slash"`; the shell supplies `leave(kind)` through
`useCommandShell()`, and the lists never call `close` themselves.

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

### FloatingActionButton

Context-aware FAB that morphs based on route:

```tsx
<FloatingActionButton />
```

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
