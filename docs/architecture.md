# Technical Architecture

## Stack

| Layer           | Technology              |
| --------------- | ----------------------- |
| Framework       | Next.js 16 (App Router) |
| Language        | TypeScript              |
| Styling         | Tailwind CSS v4         |
| Animations      | tw-animate-css          |
| Command Palette | cmdk                    |
| MDX             | next-mdx-remote         |
| Package Manager | pnpm                    |

### Portability Rules (Technical Constraints)

✅ **Always:**
- Server components (build-time)
- `generateStaticParams` for dynamic routes
- `"use client"` for interactivity
- Static export compatible

❌ **Avoid:**
- API routes, Server Actions, Middleware
- ISR, image optimization
- Vendor-specific features

## Project Structure

```
cursor/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Homepage
│   ├── globals.css         # Tailwind + custom styles
│   ├── blog/
│   │   ├── page.tsx        # Blog list page
│   │   ├── blog-list.tsx   # Client component for list
│   │   └── [slug]/
│   │       ├── page.tsx    # Static blog post page
│   │       └── content.tsx # Client component for post
│   ├── career/
│   │   └── page.tsx
│   └── talks/
│       ├── page.tsx
│       └── talks-list.tsx
├── components/
│   ├── layout/
│   │   ├── command-palette.tsx  # Command palette UI
│   │   ├── fab.tsx              # Floating Action Button
│   │   └── header.tsx           # (unused, kept for reference)
│   ├── providers.tsx            # Global state providers
│   └── mdx-components.tsx       # MDX component overrides
├── content/
│   ├── blog/                    # MDX blog posts
│   └── talks/                   # MDX talk content
├── lib/
│   ├── content.ts               # Content utilities
│   ├── data.ts                  # Static data for search
│   ├── i18n.ts                  # Translations
│   ├── mdx.ts                   # MDX processing
│   └── utils.ts                 # cn() and helpers
└── docs/                        # This documentation
```

## State Management

All global state is managed via React Context in `components/providers.tsx`:

### Theme Context
```typescript
interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}
```
- **Initialization**: System preference via `matchMedia`
- **Persistence**: Follows system (no localStorage)
- **Application**: `document.documentElement.classList.toggle("dark")`

### Locale Context
```typescript
interface LocaleContextType {
  locale: "en" | "zh";
  setLocale: (locale: Locale) => void;
}
```
- **Initialization**: 
  1. Check localStorage
  2. If empty, detect from `navigator.language`
  3. Store detected value for future visits
- **Persistence**: localStorage

### Command Palette Context
```typescript
interface CommandPaletteContextType {
  isOpen: boolean;
  isActionMode: boolean;
  open: (actionMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setActionMode: (mode: boolean) => void;
}
```

### Visitor Context
```typescript
interface LastVisitedItem {
  slug: string;
  title: string;
  type: "blog" | "talk";
}

interface VisitorContextType {
  lastVisited: LastVisitedItem | null;
  lastVisitTime: number | null;
  isReturningVisitor: boolean;
  daysSinceLastVisit: number | null;
  recordVisit: (item: LastVisitedItem) => void;
  recordPageView: () => void;
}
```
- **Initialization**: Reads from localStorage on mount
- **Persistence**: `hux_visitor` key in localStorage stores last visited item and timestamp
- **Usage**: Powers the homepage's contextual greeting ("last time you were reading...")

## Rendering Strategy

| Page | Strategy |
|------|----------|
| `/` | Client-side (locale, time, visitor context) |
| `/blog` | Client-side (filtering, hover states) |
| `/blog/[slug]` | Static generation + client hydration |
| `/career` | Client-side |
| `/talks` | Client-side |

## Homepage Components

The homepage (`app/page.tsx`) is composed of inline components that create the AI-native OS experience:

### AmbientGreeting
Time-aware greeting that speaks to the user:
- Detects time of day (morning/afternoon/evening/night)
- Shows contextual message based on visitor history
- Uses serif font for warmth

### WidgetGrid
Bento-style CSS Grid with three widget types:

| Widget | Content | Styling |
|--------|---------|---------|
| BlogWidget | 3 recent posts with dates | Large (2x1), glassmorphic |
| StatusWidget | Current status with ping | Medium (1x1), green indicator |
| TalkWidget | Latest talk with event | Medium (1x1), clickable |

### ConversationalPrompt
Inline button that opens the command palette:
- Replaces FAB on homepage
- "what brings you here?" placeholder
- Shows ⌘K hint on desktop

### Blog Post Generation

```typescript
// Static params generated at build time
export function generateStaticParams() {
  const slugs = getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

// MDX content read at build time, rendered client-side
export default async function BlogPost({ params }) {
  const content = await getBlogContent(params.slug);
  return <BlogPostContent {...content} />;
}
```

## i18n System

### Translation Keys

All UI text is centralized in `lib/i18n.ts`:

```typescript
export const translations = {
  en: { home: "Home", blog: "Blog", ... },
  zh: { home: "首页", blog: "博客", ... },
};

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key];
}
```

### Content Language

**Language is derived from filename, not frontmatter.** Files must follow the `[slug].[lang].mdx` convention:

```
content/blog/
├── my-post.en.mdx              # English only → language: "en"
├── another-post.zh.mdx         # Chinese only → language: "zh"
├── bilingual-post.en.mdx       # Both exist → language: "both"
├── bilingual-post.zh.mdx
└── some-post/                  # Directory-based (for posts with assets)
    ├── index.en.mdx
    ├── index.zh.mdx
    └── diagram.png
```

| File Structure | Derived Language | Behavior |
|----------------|------------------|----------|
| `slug.en.mdx` only | `"en"` | English-only post |
| `slug.zh.mdx` only | `"zh"` | Chinese-only post |
| `slug.en.mdx` + `slug.zh.mdx` | `"both"` | True bilingual post |

**Bilingual Post URL Behavior:**
- Base URL `/blog/slug` uses system locale
- Shareable URL `/blog/slug?lang=zh` forces specific language
- When `?lang=` conflicts with system locale, a dialog asks user to choose

| Post Type | English UI | Chinese UI |
|-----------|------------|------------|
| English-only | Shown | Hidden (checkbox to include) |
| Chinese-only | Hidden (checkbox to include) | Shown |
| Bilingual | Primary: EN, "Also in 中文" | Primary: ZH, "Also in English" |

The `shouldShowPost()` utility filters posts based on current locale and user preference.
The `validateBlogContent()` function validates file naming during build.

## CSS Architecture

### Tailwind v4

Using new Tailwind v4 syntax:

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
@theme inline { ... }
```

### Custom Utilities

- `.prose-article`: Blog post typography (see `globals.css`)
- CSS Grid animations for height transitions

### Animation Pattern

Height animations use CSS Grid instead of `height: auto`:

```css
.grid { grid-template-rows: 0fr; }  /* collapsed */
.grid { grid-template-rows: 1fr; }  /* expanded */
```

This allows smooth transitions where `height: auto` cannot animate.

## Command Palette Implementation

Built on `cmdk` library with custom styling:

### Key Features

1. **Dual-mode operation**: Search mode and action mode
2. **Morphing transitions**: Smooth animation between modes
3. **Fuzzy search**: Built into cmdk
4. **Keyboard-first**: All actions accessible via keyboard
5. **Grouped results**: Navigation, Settings, Blog, Talks

### Event Handling

```typescript
// Global shortcuts (in providers.tsx)
- ⌘K: Toggle palette
- /: Open in action mode
- Escape: Close

// Search mode shortcuts (in command-palette.tsx)
- Single letters (H/E/B/T/A/L): Execute action when input empty
- /: Switch to action mode

// Action mode shortcuts (in command-palette.tsx)
- Single letters: Execute action
- Backspace: Back to search mode
```

## Performance Considerations

1. **Static generation**: Blog posts pre-rendered at build time
2. **Client hydration**: Interactive features added client-side
3. **No layout shifts**: Consistent sizing prevents CLS
4. **Lazy MDX**: Content serialized on-demand in useEffect
