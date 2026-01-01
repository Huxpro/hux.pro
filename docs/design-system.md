# Design System

## Typography

### Font Stack

The site uses a carefully curated three-font system:

```css
--font-sans: Inter        /* UI elements, navigation */
--font-serif: Newsreader  /* Prose, article titles, emphasis */
--font-mono: JetBrains Mono  /* Dates, tags, code, shortcuts */
```

### Typographic Hierarchy

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page titles | Sans | 3xl-5xl | Semibold |
| Article titles | Serif | 4xl | Normal |
| Headings (H2) | Serif | 2xl | Normal |
| Body text | Sans | 17px | Normal |
| UI labels | Sans | sm | Medium |
| Metadata | Mono | xs-sm | Normal |

### The Serif Italic Pattern

The site uses `font-serif italic` for emphasis and literary quality:
- The word "Prose" in the tagline
- Blog subtitles
- Quotations and pullquotes

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
- **Back links**: Subtle, almost invisible (`text-muted-foreground/60`)

## Prose Styling

The `.prose-article` class provides reading-optimized styling for MDX content:

- **Font size**: 17px (slightly larger than typical UI)
- **Line height**: 1.7 (generous for readability)
- **Headings**: Serif font, normal weight, tight tracking
- **Blockquotes**: Left border, italic, muted color
- **Code**: Monospace with subtle background

See `app/globals.css` for full implementation.
