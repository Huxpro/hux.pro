# Design System
## Typography

### Font Stack

The site uses a carefully curated font system:

```css
--font-sans: Inter                    /* UI elements, navigation */
--font-serif: Newsreader, Noto Serif SC  /* Prose, article titles, emphasis */
--font-mono: JetBrains Mono           /* Dates, tags, code, shortcuts */
```

**Chinese Support**: `Noto Serif SC` (思源宋体) provides serif typography for Chinese text, ensuring headers like "散文" display with proper serif styling.

### Typographic Hierarchy

**Article/Documentation pages** (inspired by [paco.me](https://paco.me) and [ibelick.com](https://ibelick.com)):

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Article title | Sans | 2xl-3xl | Medium | foreground |
| Heading (H1 in content) | Sans | xl | Medium | foreground |
| Heading (H2) | Sans | base | Medium | foreground |
| Heading (H3) | Sans | sm | Medium | foreground, uppercase |
| Body text | Sans | 16px | Normal | foreground/85 |
| Emphasis (em, blockquote) | Serif | 17px | Italic | — |
| UI labels | Sans | sm | Medium | — |
| Metadata | Mono | xs | Normal | muted |

**Contrast hierarchy**: Body is `foreground/85`, headings are full `foreground` (slightly brighter)

### Inner Page Headers

All inner page headers (Writing, Docs, Career, Talks) use the same typography as the homepage greeting:

```css
font-serif text-3xl sm:text-4xl text-foreground tracking-tight
```

This creates visual consistency across the site and reinforces the literary, personal tone. **No subtitles** — the header stands alone.

### The Serif Italic Pattern

Serif (`Newsreader` / `Noto Serif SC`) is reserved for emphasis and literary quality:
- Homepage greeting and section titles
- Inline emphasis (`em`, `italic`) in prose
- Blockquotes and pullquotes
- Contextual hints (e.g., "*Building Design Systems*")

This creates contrast: **Sans-serif for structure, Serif for emphasis**.

### Homepage Typography

The homepage uses a distinct hierarchy to create the AI-native OS feel:

| Element | Font | Size | Style |
|---------|------|------|-------|
| System identifier (`λhux`) | Mono | sm | Muted, tracking-wider |
| Time greeting | Serif | 3xl-4xl | Normal weight |
| Contextual message | Sans + Serif italic | lg-xl | Mixed for emphasis |
| Widget labels | Mono | xs | Uppercase, tracking-wider |

## Color System

Colors are organized into two categories:

### Content Variables

Used for page backgrounds, article text, and content cards.

| Variable | Light Mode | Dark Mode | Usage |
|----------|------------|-----------|-------|
| `--background` | `oklch(1 0 0)` | `oklch(0.156 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.93 0 0)` | Primary text |
| `--card` | `oklch(1 0 0)` | `oklch(0.19 0 0)` | Card backgrounds |
| `--card-foreground` | `oklch(0.145 0 0)` | `oklch(0.93 0 0)` | Card text |

The dark mode background (`oklch(0.156 0 0)` ≈ `rgb(26, 26, 26)`) is inspired by [paco.me](https://paco.me/).

### UI Variables

Used for interactive components, overlays, and the command palette. These are intentionally darker/lighter than content to create visual layers.

| Variable | Purpose |
|----------|---------|
| `--popover` / `--popover-foreground` | Modal/overlay backgrounds (command palette) |
| `--accent` / `--accent-foreground` | Hover and selected states |
| `--muted` / `--muted-foreground` | Secondary text, kbd backgrounds |
| `--border` / `--input` / `--ring` | Form elements, borders, focus rings |
| `--primary` / `--secondary` | Button variants |
| `--destructive` | Destructive actions |

**Important**: Changes to UI variables affect the command palette (`command-palette.tsx`). Modify these with care.

### Dark Mode Values

```css
/* Content (page background and text) */
--background: oklch(0.156 0 0);  /* rgb(26, 26, 26) - paco.me inspired */
--foreground: oklch(0.93 0 0);   /* softer than pure white */

/* UI (overlays are darker for layering) */
--popover: oklch(0.205 0 0);     /* modal backgrounds */
--muted: oklch(0.269 0 0);       /* kbd, secondary backgrounds */
--accent: oklch(0.32 0 0);       /* hover states */
--border: oklch(1 0 0 / 10%);    /* subtle borders */
```

### Design Note

All colors use **OKLCH** color space for perceptually uniform transitions. The palette is intentionally **grayscale** with no accent colors—the content provides the color.

## Spacing & Layout

### Content Width

All content is constrained to a comfortable reading measure:
```css
max-width: 680px  /* ~65-75 characters per line */
```

### Home Screen Grid

The home screen is a *composition*, not a document: identifier → greeting →
widget grid. Two rules keep it at home on any display (`app/page.tsx`,
`components/ui/sortable-masonry.tsx`):

- **Centered when there is room.** `main` is `min-h-svh` and the composition
  carries auto margins, so it settles optically centered on tall screens
  (iPad Pro portrait, large desktops) and snaps back to the top-anchored
  layout the moment the content outgrows the viewport — phones, tablets and
  normal laptops are unchanged.
- **More widgets, not bigger ones.** Column count and container width move
  together so a widget stays ~330px wide at every step, iPad-springboard
  style:

  | Breakpoint | Columns | Container |
  |---|---|---|
  | — | 1 | 680px |
  | `sm` | 2 | 680px |
  | `lg` | 3 | 1024px |
  | `roomy` | 3 (4 with ≥ 8 widgets) | 1152px (1344px) |

  The fourth column waits for enough widgets to fill it: CSS multicol
  balances by height, so a fourth column over a handful of cards reads as a
  lopsided, half-empty grid. `roomy:` (defined in `globals.css`) is the last
  step's gate — ≥ 96rem wide **and** ≥ 1000px tall, since the point is to
  spend space the screen actually has spare; a short ultrawide is already
  scrolling and keeps the familiar desktop board.

### Vertical Rhythm

- **Page padding**: `pt-24 pb-32` (generous breathing room)
- **Section spacing**: `mb-16` to `mb-20`
- **Paragraph spacing**: `mb-6`
- **List item spacing**: `mb-2`

## Interaction & Motion

- **Motion is functional, not expressive**
- **Used to indicate**: focus, transition, state change
- **Prefer**: opacity, transform, blur, scale (subtle)

> If motion doesn't explain something, remove it.

### Touch

Touch gets the iOS contract, not a mouse's. Three classes in `globals.css`
carry it; nothing is inferred from the pointer type at runtime.

| Class | Where | What it does |
|---|---|---|
| `pressable` | Rows, links, buttons, tiles — anything with a `hover:` wash | Pair with an `active:` colour/scale. The `:active` rule zeroes the transition so the highlight lands on the **touch-down frame** (Tailwind's `hover:` is gated on `(hover: hover)`, so a finger otherwise gets nothing); release eases out through the element's own `transition-*`. |
| `system-chrome` | Navigation, command bar, dock, palette, edit controls | OS chrome: no text selection, no long-press callout, no grey tap flash. Text fields inside keep their caret. |
| `press-hold` | Widgets and app icons (via `usePressHold`) | The visual half of a long-press: the held object grows slowly for the sensor's whole activation delay, then pops to its lifted size (`widget-lift`). Letting go or scrolling eases it back. |

**Long-press semantics, by surface:**

- **App icons / widgets** — a long-press picks the object up (400ms hold,
  10px tolerance, `TOUCH_ACTIVATION`). No system callout, no selection.
- **Content** (prose, the `/writing` list, `/works` rows) — browser defaults.
  A long-press on a link still opens the system preview; text stays
  selectable. Only the press wash is added.
- **System chrome** — nothing: not selectable, no callout.

While the home grid is in edit mode the command bar steps aside and the
**Done** pill takes its slot (`home-edit-store.ts`, shared `layoutId`), the
way iOS trades the dock for Done.

## Components

### Pills / Tags

Used for language filtering and keyboard shortcuts:
```css
px-2.5 py-1 text-xs font-mono rounded-md
/* Active: */ bg-muted text-foreground
/* Inactive: */ text-muted-foreground hover:text-foreground hover:bg-muted/50
```

### Keyboard Badges

Displayed in command palette and hints:
```css
px-1.5 py-0.5 text-xs font-mono bg-muted/50 rounded
```

### Links

- **Navigation**: Underline on hover with transition
- **Prose**: Persistent underline with `decoration-muted-foreground/50`
- **Back links**: System UI style (see below)

### Mono System UI

All monospace elements (machine-layer, non-translatable UI) use consistent styling:

| Property | Value | Notes |
|----------|-------|-------|
| **Size** | `text-xs` | Uniform across all mono UI |
| **Idle color** | `text-muted-foreground` | |
| **Hover color** | `text-foreground` | |

The font choice (Mono) already distinguishes system UI from content. No additional size or opacity hierarchy is needed within this layer.

**Exceptions**:
- **Inline code** in prose uses `text-sm` (relative to surrounding body text)
- **Input placeholders** use `text-muted-foreground/60` (meant to disappear when user types)

### System UI Navigation

All navigation elements (back to home, back to writing, etc.) follow a consistent "System UI" design language:

```css
/* SystemNav component */
font-mono text-xs tracking-wide
text-muted-foreground hover:text-foreground
transition-colors duration-200
```

**Key principles:**
1. **Monospace font** – Same as other system elements (dates, tags, keyboard badges)
2. **Path-first display** – Shows destination path by default (e.g., `/docs`, `λhux`)
3. **Scramble to command** – On hover, scrambles to `cd ..` for terminal-like interaction
4. **Instant navigation** – Click works immediately, not blocked by animation

**Path conventions:**
- `λhux` – Root/home (brand identifier)
- `/writing` – Writing list (blog posts)
- `/docs` – Documentation list

**Usage:**
```tsx
import { SystemNav } from "@/components/ui/system-nav";

// Back to home (shows "λhux", scrambles to "cd .." on hover)
<SystemNav href="/" path="λhux" className="mb-12" />

// Back to writing list (shows "/writing", scrambles to "cd .." on hover)
<SystemNav href="/writing" path="/writing" className="mb-12" />

// Custom hover text
<SystemNav href="/docs" path="/docs" hoverText="cd ~/docs" className="mb-12" />
```

### Homepage Widgets

Glassmorphic cards used on the homepage for content discovery:

```css
/* Base widget styling */
p-5 rounded-2xl
bg-card/50 backdrop-blur-xl
border border-border/50
transition-all duration-300

/* Hover state */
hover:border-border hover:bg-card/70
```

Widget headers use monospace uppercase labels:
```css
text-xs font-mono uppercase tracking-wider text-muted-foreground
```

### Conversational Prompt

The homepage search entry point styled as a dialogue invitation:

```css
/* Container */
w-full max-w-md
flex items-center gap-3 px-5 py-4
bg-card/50 backdrop-blur-xl
border border-border/50 rounded-2xl

/* Placeholder text */
text-muted-foreground text-sm
/* "what brings you here?" */
```

## Prose Styling

The `.prose-article` class provides reading-optimized styling for MDX content:

- **Font size**: 17px (slightly larger than typical UI)
- **Line height**: 1.7 (generous for readability)
- **Headings**: Serif font, normal weight, tight tracking
- **Blockquotes**: Left border, italic, muted color
- **Code**: Monospace with subtle background

See `app/globals.css` for full implementation.

### Code Blocks

Code blocks use minimal contrast to blend seamlessly with content:

```css
/* Code block container */
.prose-article pre {
  @apply bg-muted/50 rounded-lg border border-border;
  /* Matches table header background for consistency */
}

/* Inline code */
.prose-article code {
  @apply font-mono text-sm bg-muted px-1.5 py-0.5 rounded;
}
```

**Design decisions:**
- **Background**: `bg-muted/50` (50% opacity) — matches table header background for visual consistency
- **Contrast**: Minimal — code blocks should feel integrated, not stand out
- **Padding**: `p-4` on container, no extra padding on individual lines
- **Syntax highlighting**: Uses shiki theme colors for tokens, but background is controlled by site theme

This creates a subtle, cohesive look where code feels like part of the content rather than a separate element.
