# Command System

> The checklist form of this page's catalog and policy rules (adding a command, what Ask may run) is the skill `.claude/skills/ask-commands`.

⌘K: the site's palette, inspired by Spotlight, Raycast and VS Code. One
list of commands reached four ways (a search row, the slash list, a single
letter, and Ask's tools), an app launcher, a voice field, and the floating
button that opens it. `systems/command/`.

## What it looks like done well

On a desk, the popover: a glass card in the upper third, the apps strip
first, then Navigation, Actions and Settings, then Writing. Every row that
has a slash letter shows it; the footer teaches the keys.

![The desk popover: the search field with its microphone and Ask AI tab hint, the apps strip ending in a dashed Load tile, the Navigation rows with their letters H U X P O, and the footer's key hints.](/img/docs/system-command/palette-desk.png)

1280×860, palette open with ⌘K on the home page. Letters sit at the trailing
edge of each row; the trailing edge of the field holds the microphone and
`Ask AI tab`; the home's search bar and the Ask ball stand under the card.

On a phone, the sheet. The same bodies; only the chrome changes. A sub-mode
is a second sheet stacked on the palette, never a body swapped in.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-command/palette-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="The palette as a phone sheet at its lower detent: the field with the microphone and the slash chip, the apps strip showing five tiles and a sliver of the sixth, and the Navigation rows without letters." />
  <img src="/img/docs/system-command/slash-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="The slash sheet stacked on the palette: the palette's top edge peeks above it; Navigation and Actions rows, no letters." />
  <img src="/img/docs/system-command/bundle-phone.png" style={{ width: "calc(33.3% - 0.67rem)", margin: 0 }} alt="The Load bundle sheet stacked on the palette: only as tall as a hint, a URL field and an Open button; the palette dimmed and receded behind it." />
</div>

iPhone 15 Pro viewport, headless (no keyboard, zero safe-area insets). Left:
the palette at seven tenths; no letters, because there is no keyboard, and
the slash chip in the field instead. Middle: the slash sheet, level with the
palette's detent, the palette's top edge peeking above. Right: the bundle
sheet, the height of its form and no more.

Typing filters every group in place; a group with nothing left hides.

![The popover with "wall" typed: the apps strip is gone, Settings shows Wallpaper and Tint, Writing shows posts matched by their text.](/img/docs/system-command/search-query.png)

`wall`: no app matches, so the strip is gone; Wallpaper matches by name and
Tint by its keyword `wallpaper colour`; the posts below matched on their
descriptions or body text, not their titles. The Ask row (`Ask AI: wall`) is at the end
of the list, out of view here; a query that reads as a question puts it
first instead.

## How it works

```
systems/command/
├── provider.tsx        # CommandProvider / useCommand: open, modes, Ask placement, global keys
├── ask-state.ts        # The pure state machine behind the palette and Ask sharing a room
├── palette.tsx         # CommandPalette: picks the shell (sheet or popover)
├── sheet.tsx           # The phone shell: SurfaceSheet with detents, sub-modes as nested sheets
├── popover.tsx         # The desk shell: a draggable Spotlight card that morphs between modes
├── catalog.ts          # COMMAND_CATALOG: titles, model-facing descriptions, targets, policy
├── actions.tsx         # useCommandActions (the one implementation list), CommandKind, shell context
├── results.tsx         # Search results, the Ask row, the slash list; shared by both shells
├── search-filter.ts    # The palette's one scoring policy (tested by pnpm command:test)
├── apps-launcher.tsx   # CommandAppsStrip: the horizontal apps strip and its Load tile
├── load-bundle-panel.tsx  # LoadBundlePanel: the OTA Lynx bundle URL form
├── voice.tsx           # Voice in the field: the microphone, Space-to-talk, / V
├── fab.tsx             # FloatingActionButton: the search bar / round button and the Ask ball
├── use-compact-viewport.ts  # Below Tailwind md (767px): the strip's pitch, the FAB's layout
└── index.ts            # Barrel exports
```

### One command, four ways in

A command is one entry in `catalog.ts` (what it is, for people and for the
model) and one entry in `useCommandActions()` (what it does). The search
rows, the slash list, the slash letters and Ask's `command_<id>` tools all
end in the same `run`.

![The catalog feeds Ask's generated command tools, which go through executeAskCommand and the Ask host to CommandAction.run; useCommandActions, typed against the catalog, feeds the search rows and the slash list, which go through useRunCommand to the same run, and then leave the palette by the command's kind.](/img/docs/system-command/pipeline.svg)

The left lane never decides policy in the model: `executeAskCommand` turns
anything not explicitly requested, not in the visible conversation, behind a
`user-gesture` policy or missing a target into an offer card. The right lane
decides only what the palette does afterwards, from the command's `kind`.

`CommandAction.id` is a `CommandId`, so a command without a catalog entry
(and so without a description) fails type checking. Titles in the catalog
are what Ask's cards show; a row's `label` is the palette's own, usually
carrying the current value (`Appearance: Follow the Sun`).

### Commands and what the palette does after

`useCommandActions()` returns 19 commands (Voice only where speech
recognition exists, Install only until the site is installed). Each carries
a `kind`:

| Kind | Does | After, from search | After, from the slash list |
|------|------|--------------------|----------------------------|
| `navigate` | goes somewhere | closes | closes |
| `surface` | opens a secondary surface | popover closes; sheet stays behind it | same |
| `toggle` | flips a setting | stays, so the new value reads back | closes |
| `stay` | changes what the palette is doing (Voice, Ask) | stays | stays |

`useRunCommand()(action, origin)` holds that table, with `origin` being
`"search"` or `"slash"`; the shell supplies `leave(kind)` through
`useCommandShell()`, and the lists never call `close` themselves. Two kinds
are chosen with care: About is `navigate`, not `surface`, because a sheet
left behind would show through the About's veil; Devtool is `surface` while
it is off (turning it on opens a drawer) and `toggle` while it is on.

Three flags decide where a command is listed:

- `section`: `navigation`, `actions` (one thing, now: Voice, Ask, Music,
  Install, Sky Window) or `settings` (a value that stays). The palette's
  groups follow this order.
- `slashOnly`: in the slash list, never a search row, because its control is
  already on screen (Voice: the field's microphone; Ask: the Ask row and the
  Tab hint).
- `searchOnly`: found, never offered. Not in the list the palette opens on,
  nor in the slash list; a query that matches it (`lab`, `实验`) brings it in,
  and its letter still runs it. Labs and Sky Window. Keyboard-only commands
  (Docs) are one step quieter: no `label`, so no row anywhere, only `/` `I`.

### Two shells

`palette.tsx` declares the shell per breakpoint against the surface
system's breakpoints (`useBreakpointValue`, `SURFACE_BREAKPOINTS`), so the
palette changes shape at the same widths as every secondary surface without
pretending to be an `AdaptiveSurface`:

| Viewport | Devtool **Phone palette** | Shell | Where |
|----------|---------------------------|-------|-------|
| Below `sm` (640px) | Sheet (default) | **Sheet**: `SurfaceSheet` with `SHEET_DETENTS` (`[0.7, 1]`) | `sheet.tsx` |
| Below `sm` | Popover | **Popover** | `popover.tsx` |
| From `sm` up | either | **Popover**: the centred Spotlight card, draggable | `popover.tsx` |

The devtool row is a saved setting (`phonePalette`) that swaps
`COMMAND_PRESENTATION` (`{ base: "sheet", sm: "popover" }`) for
`POPOVER_PRESENTATION` (`{ base: "popover" }`): one presentation map, no
second code path. Both shells render the same bodies (`results.tsx`) from
the same command list; a shell only decides chrome and how the palette
leaves.

#### The sheet

The same sheet the wallpaper picker and the playlist are, with the search
field where their title bar is. It opens at seven tenths of the screen; a
drag or a tap into the field carries it to the top (`onFieldTap`), the way
Maps' sheet grows when its search field is tapped, so the keyboard has the
most room under it. Dragging it back below the top blurs the field, so the
lower detent is not half hidden behind a keyboard.

A launcher is not a secondary surface, so the sheet is `modal`: the page
stops answering while it is up, and a tap on the page dismisses it, as a
click on the page dismisses the popover.

**Stacking.** A `surface` command (the wallpaper picker) does not close the
palette on a phone. The palette stays and steps back while the picker rises
over it (the surface stack does that; from a sub-mode sheet the palette
steps back two), and closing the picker brings it forward again. Only the
keyboard goes. On the desk the popover closes.

**Sub-modes as nested sheets.** The palette has two sub-modes, mutually
exclusive (`isSlashCommandsMode` / `isLoadBundleMode` in `provider.tsx`).
Each is a task that returns to the palette when done, so on a phone each is
a second sheet stacked on the palette, the way iOS presents a sheet from a
sheet.

| Sub-mode | Sheet | Height | Reached by | Leaves by |
|----------|-------|--------|------------|-----------|
| Slash commands | `command-slash` | level with the palette's detent | the `/` chip, `/` in the empty field, `/` outside any field | close, drag down, tap the palette, a command, Backspace |
| Load bundle | `command-bundle` | its content (`fitContent`) | the apps strip's Load tile (`openLoadBundle()`) | close, drag down, tap the palette, Open |

Both headers (`SubModeHeader`) are the same shape: an icon, the title, and
one way out one level down; the palette's own close stays on the palette.
Both are React children of the palette's sheet (`nestedIn="command"`), so
Base UI treats them as nested, disables the parent's swipe while one is up,
and Escape pops one sheet at a time. The slash sheet stands level with the
palette (`detentHeight(detent)` + `level={detent}`, read once on the way in)
so its list picks up where the palette's left off. The bundle sheet takes
the height of a hint, a field and a button, and rests on the keyboard that
comes up for its field (`--drawer-keyboard-inset`, handled once in
`SurfaceSheet`); `LoadBundlePanel chrome="sheet"` drops the panel's own back
arrow and title because the sheet header carries them.

**The field's trailing edge.** In both shells: the microphone, then either
`Ask AI tab` (where there is a keyboard) or the slash chip (where there is
not, and only while the field is empty, which is exactly when typing `/`
would have worked). The chip is the hint made pressable: the same kbd
vocabulary with a rim and a touch-sized hit area.

**Keyboard hints** (row letters, the footer, `esc`, the Tab hint) follow
the input device, not the shell: `useShowKeyboardHints()` reads
`hasFineHoverPointer` from `services/input-capability`. A desk shows them;
so does an iPad the moment a trackpad is attached; a phone and a bare iPad
do not, in either shell.

How the sheet meets the software keyboard (16px fields, the inset, no
autofocus) is [Typing on a phone](./keyboard-input.md).

#### The popover

A centred card a little below Spotlight's place (`--command-palette-offset`:
`min(22vh, 13.5rem)`), draggable through `useDraggable("command-palette")`,
closed by a click on the page. It morphs between its four modes in one card,
animating width, header and footer rather than swapping:

| Mode | Card width | Body |
|------|-----------|------|
| Search | 700px | `CommandResults`, list capped at `min(40rem, 43dvh, …)` |
| Slash | 400px | `CommandSlashList`, no `43dvh` cap, so the card grows for the full list |
| Load bundle | 440px | `LoadBundlePanel` with its own back arrow and title |
| Ask | 700px, 960px with the history rail | `AskChat` ([Ask](./system-ask.md)) |

The search cap lands on Geolocation as the last full row on a 16" laptop.
With Ask parked at the side, the card centres in the room left and its
click-away stops at the panel.

The popover keeps its iOS Safari accommodations, keyed to the phone
(`/iPhone|iPod/`), not to iOS, for when the devtool puts it on one: the page
is pinned at its scroll position (`absolute`, `top: scrollY`, body overflow
hidden), the field is not focused on open, and the backdrop dismisses on
pointer-down. iPad Safari is treated like a desk.

### Search

cmdk does the list; `usePaletteFilter` scores it.

- **The scoring policy** is `scorePaletteItem` in `search-filter.ts`. A
  row's identity (its value without the internal `app-` / `blog-` prefix,
  plus its primary keywords) matches fuzzily. Supporting text wrapped by
  `detailKeywords` (command keywords, post descriptions and tags) is
  ignored for a one-letter Latin query, so `p` does not surface whatever
  has a `p` in its description. Category words wrapped by `exactKeywords`
  (`app`, `apps`, `post`, `lynx`, `文章`…) match only as the whole query, so
  `app` lists every app, while `p` matches no app merely because its value
  is `app-…`.
- **Posts by their text.** Once the query has two characters the Ask
  search index (`systems/ask/lib/search`) loads; a post whose body matches
  and whose title did not still shows, scored `0.05`.
- **The Ask row** is there whenever the field has text. A query that reads
  as a question (`isQuestionLike`, `systems/ask/lib/intent`) puts it first
  and selects it a frame later (`usePaletteSelection`), so ↵ asks; anything
  else puts it last, where ↓ or Tab reaches it. Tab in the field always
  enters Ask with what was typed.

### The apps strip and Load bundle

When the Window system is mounted, the first group is a headerless,
horizontally scrolling strip of every app in `content/apps.json` (the full
catalog, including `featured: false` apps like BusyWeek and Cat Wand that
the home folder omits), drawn with the shared `AppTile` at `md` (48px). It
looks the same browsing and searching: it filters its tiles with the same
scorer and hides when nothing matches. Below Tailwind `md` the column pitch
is about 5.3 tiles wide, so an iPhone shows five and a sliver of the sixth.

The last tile, **Load…**, opens the bundle form (`openLoadBundle()`): one
URL field (`http(s)://` or a site path), one Open button. Open calls
`windows.openBundleUrl(url)` and the whole palette leaves.

### Voice

The microphone in the field's trailing cluster speaks into the field
(`useCommandVoice`, over `systems/voice`). Three ways in, all inside the
palette, so none collides with a system dictation key:

| Way | Gesture |
|-----|---------|
| The microphone | browser recognition: tap to listen until a pause; a Gateway model: tap to record until stop, or hold and release |
| `/` `V` | tap to start; hold for `HOLD_MS` (300ms) or more and release to stop |
| Space in the empty field | hold to talk, release to stop; a tap does nothing |

What is heard becomes a query (`toFieldText`: "go to the writing" →
`writing`), unless it reads as a question, which goes in whole for Ask.
While it listens, the field's edge shows the site's glow (`Glow`,
`shape="line"`) or a waveform, per the voice-visual preference.

### The floating button

`FloatingActionButton` is the way in that is always on screen, with the Ask
ball beside it.

<div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
  <img src="/img/docs/system-command/fab-phone-home.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The home page on a phone: a wide Search bar at the bottom centre, the round Ask ball to its right." />
  <img src="/img/docs/system-command/fab-phone-page.png" style={{ width: "calc(50% - 0.5rem)", margin: 0 }} alt="The Writing page on a phone: a round command button at the bottom right, the Ask ball stacked above it." />
</div>

On the home it is a search bar (`Search`; `Search or / for commands` and a
`⌘K` chip from `md`), with the ball to its right. Elsewhere it morphs into
a 48px round button at the trailing edge (from `md`, a pill reading ⌘ K),
with the ball to its left, or above it below `md`. The desk shape
is under the card in the first screenshot.

- A press toggles the palette. The ball opens or closes Ask (`K` does the
  same) and is lit while Ask is open.
- Holding the button 1.2s summons the devtool; a ring appears after 0.7s.
- Away from the home it is draggable when its drag setting is on
  (`useDraggable("command-fab")`).
- On a phone, while the home grid is being edited, it fades out so the
  edit controls can take the bottom of the screen.
- With Ask at the side, it steps left by the panel's width.

## Rules

| Rule | Why | What breaks |
|------|-----|-------------|
| Every command has a `COMMAND_CATALOG` entry with a description and a `policy.execution` | Ask's tools, cards and the benchmark are generated from it; `CommandAction.id` is typed against it | Type check fails; or a command Ask cannot describe |
| A command's behaviour lives only in its `run` in `useCommandActions` | The palette and Ask must do exactly the same thing | Ask and a tap disagree |
| `run(ctx)` honours `ctx.value` for every catalog option, and only cycles when there is none | Ask applies exact targets through `run({ value })` | "Set dark" toggles to light |
| Anything that needs user activation (microphone, GPS prompt, starting audio, opening the devtool) is `user-gesture`, or listed in `gestureValues` | A model's tool call has no user activation; the tap on the card does | The browser refuses, or a permission prompt appears unasked |
| `kind` describes what the press does to the screen | `useRunCommand` decides the palette's exit from it | A sheet left behind a veil, or a palette closed under the picker it just opened |
| The lists leave through `useCommandShell().leave(kind)`, never `close()` | The shell decides: the popover closes, the sheet may stay | The sheet's stack breaks |
| Slash letters are unique | `SlashShortcuts` runs the first command with the key | The second command's letter silently does nothing |
| Keyboard hints come from `useShowKeyboardHints()` | Hints are about the input device, not the width | Letters on a phone, none on an iPad with a keyboard |
| Sub-mode sheets keep `restoreFocus={false}` and no detents | Focus handed back to a field on iOS opens the keyboard on the next touch; a sheet with detents reports its swipe between them, and the palette needs the plain fraction to come forward under the finger | A keyboard out of nowhere; a palette that does not follow the drag |
| Fields are 16px on a phone (`text-[16px] sm:text-sm`) | iOS Safari zooms below 16px | A zoomed page on focus |

## What is free to choose

- A command's letter (any unused one; taken: A C D E G H I K L M O P T U V W X).
- Its `section`, icon, label wording and keywords (both languages).
- Whether it is `searchOnly`, `slashOnly`, or keyboard-only (no label).
- The popover's geometry (`PALETTE_GEOMETRY` in `popover.tsx`) and the
  sheet's detent choice, within the surface system's detents.
- The scoring constants (`FULL_TEXT_SCORE`, which words are exact or
  detail), as long as `pnpm command:test` still passes.

## Adding a command

1. `catalog.ts`: an entry with `title { en, zh }`, a `description` written
   for the model (what it does, what each target means, what to do without
   one), `options` if it takes a target, and `policy.execution`
   (`gestureValues` for targets stricter than the rest).
2. `actions.tsx`, in `useCommandActions()`: `id`, `key` if it gets a letter,
   `kind`, `section`, `label` (with the current value if it has one),
   `icon`, `keywords` in English and Chinese, and `run(ctx)` that applies
   `ctx.value` when given. Gate availability by leaving it out of the array
   (as Voice and Install are).
3. Run `pnpm command:test`, `pnpm ask:test` and `npx tsc --noEmit -p .`;
   `pnpm ask:benchmark` if tool choice could change.
4. Update the counts and policy table in
   [system-ask.md](./system-ask.md#command-tools) and the slash letters
   below.

## Reference

### Keys

| Key | Where | Action |
|-----|-------|--------|
| `⌘K` / `Ctrl+K` | anywhere | Toggle the palette. If Ask is the center chat (or the Dock panel on a desk) it parks first: the side when it fits, a pill on a narrower desk, the Dock on a phone. Closing the palette puts it back |
| `/` | outside a field | Open in slash mode, with the same park. In a field it is a character, except in the palette's empty field, where it enters slash mode |
| `K` | outside a field, palette closed or in Ask | Open Ask, or close it if it is open |
| `Tab` | the palette's field | Ask, carrying what was typed |
| Space (held) | the palette's empty field | Talk; release to stop |
| `↑` `↓` `↵` | search | cmdk's selection |
| `Backspace` | slash mode | Back to search |
| `Esc` | palette | Load bundle → search; Ask → search if search was the way in, else close; otherwise close (and restore a parked Ask). On a phone a sub-mode sheet pops first |

### Slash letters

In the slash list, by section. All letters work while the list is up,
including the unlisted ones.

| Key | Command | Kind | Section |
|-----|---------|------|---------|
| `H` | Home | navigate | navigation |
| `U` | Writing | navigate | navigation |
| `X` | Works | navigate | navigation |
| `P` | Prompts | navigate | navigation |
| `O` | About (its only shortcut; [system-about.md](./system-about.md)) | navigate | navigation |
| `I` | Docs (keyboard-only, not listed) | navigate | navigation |
| `E` | Labs, `/lab` (search-only, not listed; `L` is Language) | navigate | navigation |
| `V` | Voice (where supported; slash-only) | stay | actions |
| `K` | Ask (slash-only) | stay | actions |
| `M` | Music: play / pause | toggle | actions |
| `A` | Appearance: Follow the Sun → the theme the sun isn't showing → the one it is → Follow the System | toggle | settings |
| `L` | Language | toggle | settings |
| `C` | Geolocation, IP ↔ accurate (`c` for coordinates) | toggle | settings |
| `W` | Wallpaper picker | surface | settings |
| `G` | Glass: tinted ↔ clear | toggle | settings |
| `T` | Tint: wallpaper ↔ neutral | toggle | settings |
| `D` | Devtool | surface / toggle | settings |

Install (actions, until installed) and Sky Window (actions, search-only)
have no letter.

### `useCommand()`

From `provider.tsx`. The palette: `isOpen`, `isSlashCommandsMode`,
`isLoadBundleMode`, `isAskMode`, `open(slash?)`, `close`, `toggle`,
`setSlashCommandsMode`, `openLoadBundle`, `setLoadBundleMode`,
`setAskMode`. Voice: `voiceRequest`, `voiceHoldKey`, `requestVoice(key?)`.
Ask's placement (`askPlacement`, `askPill`, `askStarted`, `askEntry`,
`askRequest`, `openAsk`, `moveAsk`, `closeAsk`, `minimizeAsk`) is
documented in [Ask](./system-ask.md); its transitions are the pure reducer
in `ask-state.ts`.

### Tests

- `pnpm command:test`: the scoring policy (`scripts/tests/command-filter.test.mjs`).
- `pnpm ask:test`: Ask's command tools, policy, execution and offer cards
  (`scripts/tests/ask-commands.test.mjs`).
