# Design Philosophy

Why hux.pro looks and behaves like a personal operating system, in a few
principles to weigh when a change meets a choice the rules don't cover. The
rules themselves (the two voices, Prose and System; type, colour, glass,
touch) are [Design System](./design-system.md). These are judgments, not
checks a change can pass or fail.

The home screen should feel like an OS that recognises you, not a page that
markets someone. The site borrows from Apple's systems (the springboard,
Spotlight, Live Activities, Liquid Glass, Siri's light), from command
launchers, and from quiet personal sites for its prose, and from marketing
sites nothing.

## Principles

### 1. Presence before structure

Meeting the site should feel like meeting a person, not reading a
directory: it says who is here before it lists what is available, and it
knows what it can know without being asked.

- The greeting follows the sky, not only the clock: sunrise and sunset get
  their own line (`getAmbientGreetingKeyFromPhase`,
  `systems/ambient/lib/greeting.ts`), and the wallpaper is the local weather
  (`systems/ambient`).
- A returning visitor is acknowledged under it: "Last Read *title*.", or
  "Welcome Back", or "It's Been A While" after more than seven days
  (`systems/ambient/components/greeting.tsx`). Brief, warm, never demanding
  a reply.
- A newcomer is met by the About, the one surface that opens without being
  asked, once (`systems/about/provider.tsx`).

### 2. Conversation as navigation

The palette is the way around, and it can be asked as well as searched.

- ⌘K searches everything; a question becomes Ask, whose tools read the site
  and offer the palette's own commands (`systems/ask/lib/command-tools.ts`,
  generated from `systems/command/catalog.ts`). See [Ask](./system-ask.md).
- A new feature is a command first. A control on a page is a shortcut to it,
  not the only way in.

### 3. Keyboard first, thumb equal

On a desk the site is driven like Raycast or Spotlight; on a phone, like
iOS. Neither is a degraded copy of the other.

- ⌘K opens the palette and `/` opens its slash list from anywhere
  (`systems/command/provider.tsx`); a slash letter then acts (`/` `O` the
  About, `/` `E` the labs; `systems/command/actions.tsx`).
- Where there is no keyboard, the same `/` is a chip in the field
  (`SlashEntry`, `systems/command/results.tsx`), and the home grid's edit
  controls move to the bottom of the screen, where the thumb is.

### 4. Fluid boundaries

Writing, talks, projects and music are aspects of one person, not separate
rooms.

- The home grid mixes them, one widget each, ordered by the visitor
  (`app/home-view.tsx`).
- One question covers all of them: Ask's index holds posts, works, eras and
  prompts side by side (`AskDocKind`, `systems/ask/lib/corpus.ts`).

### 5. Bilingual by design

English and Chinese are equals, not a source and a translation.

- First visit takes the browser's language; the choice is kept after that
  (`services/locale.tsx`).
- A post is in English, Chinese or both (`content/blog/<slug>.<en|zh>.mdx`),
  and `/writing` shows the visitor's language first, with "All" one chip
  away (`LanguageFilter`, `components/post/post-list.tsx`).
- Every visible string has both (`lib/i18n.ts`), and a widget, a lab or a
  command that ships in one language is unfinished.

### 6. Progressive disclosure

Show what a thing is; reveal more on attention.

- A `/writing` row is a title and a date; pointing at it peeks the post's
  description, excerpt and cover (`components/post/post-peek.tsx`).
- Settings live where they act, not on a settings page: site-wide ones
  (theme, glass, tint) are palette commands, an article's typeface, size
  and measure are its `Aa` (`components/post/reading-sheet.tsx`).

### 7. Less, but better

Design is how it works, so the test for a mark is what it *does*, not how it
looks. Before adding a label, a badge, an arrow or an icon, ask whether the
surface already says it. If it does, the mark is a second way of saying the
same thing, and it goes, or it waits until someone is paying attention.

- **One voice per layer.** The machine layer is lowercase mono (`jul 2020`,
  `retry`, `cd ~`). Capitals and letter-spacing would be a second machine
  voice over the first ([Design System](./design-system.md)).
- **Signifiers wait for attention.** A widget is its own tap target and a
  peeking cover says its strip scrolls. The header arrow and pager dots show
  when a pointer or focus is on the card, and never under a finger
  (`WIDGET_REVEAL`, `components/ui/widget.tsx`).
- **A preview previews.** A home card says what a thing is, in full, and its
  row opens the full entry. Outbound links and attachments live on the page
  the card leads to, not on the card at the title's expense.
- **Curation acts, it doesn't annotate.** `featured` decides what the home
  card surfaces. The archive is already complete and in date order, so it
  shows no badge (`components/post/post-list.tsx`).

Nothing here removes an experience: the wallpaper, the scramble, the peeks,
the theater, music, the apps and the palette all stay. What goes is the chrome
that repeated them.

## What it avoids

- Marketing furniture: hero banners, social proof, testimonials, newsletter
  and cookie popups.
- A brand or accent colour. The content brings the colour (a wallpaper, a
  cover); the UI is greyscale ([Design System](./design-system.md)).
- A navbar across the top. Navigation is a keystroke or the floating command
  bar.
- Anything that opens unasked, except the About, once.
- Motion that explains nothing ([Motion](./motion.md)).
