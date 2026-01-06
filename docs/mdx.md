# MDX Setup

This document describes our Markdown/MDX rendering setup and the rationale behind our technology choices.

## Stack

| Package | Purpose |
|---------|---------|
| `next-mdx-remote` | Server-side MDX compilation with RSC support |
| `rehype-pretty-code` | Shiki-based syntax highlighting |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) |
| `shiki` | Syntax highlighting engine (used by rehype-pretty-code) |
| `gray-matter` | Frontmatter parsing |

## Architecture

```
content/*.mdx
    ↓
gray-matter (frontmatter extraction)
    ↓
next-mdx-remote/rsc (server-side compilation)
    ├── remark-gfm (tables, GFM features)
    └── rehype-pretty-code (syntax highlighting)
    ↓
React components (custom MDX components)
    ↓
Rendered HTML
```

### Key Files

- `lib/mdx-processor.ts` — MDX options configuration with plugins
- `components/mdx-renderer.tsx` — Server component that renders MDX
- `components/mdx-components.tsx` — Semantic/logic overrides (see convention below)
- `app/globals.css` — All prose styling (`.prose-article` section)

### Styling Convention

**IMPORTANT**: MDX components are intentionally "context-less" — they contain no visual styling.

| Concern | Location | Example |
|---------|----------|---------|
| **Typography** | `app/globals.css` | Font sizes, margins, colors |
| **Visual styling** | `app/globals.css` | Backgrounds, borders, spacing |
| **Semantic logic** | `mdx-components.tsx` | External link detection |
| **Custom components** | `mdx-components.tsx` | `CodeBlock`, table wrapper |

This separation allows MDX components to be reused in different contexts with different styles. All prose styling is centralized in the `.prose-article` CSS class.

See `components/mdx-components.tsx` for detailed documentation.

## Features

### Syntax Highlighting

Code blocks are highlighted using Shiki with the `github-dark` theme:

```typescript
function hello(name: string) {
  console.log(`Hello, ${name}!`);
}
```

Supports:
- **Line highlighting**: ` ```js {1,3-5} `
- **Word highlighting**: ` ```js /word/ `
- **Diff syntax**: Lines starting with `+` or `-`
- **Language badge**: Displayed in top-right corner

### GFM Tables

| Feature | Supported |
|---------|-----------|
| Tables | ✅ |
| Strikethrough | ✅ |
| Task lists | ✅ |
| Autolinks | ✅ |

### Custom Components

MDX elements receive semantic overrides from `mdx-components.tsx`:
- **Links**: External link detection (opens in new tab)
- **Code**: Inline vs block code detection
- **Tables**: Horizontal scroll wrapper

All visual styling is handled by CSS in `app/globals.css` (`.prose-article` class).

## Why Not Fumadocs?

We evaluated [Fumadocs](https://fumadocs.vercel.app/) but chose to build a custom stack instead. Here's why:

### 1. Design Independence

Fumadocs comes with `fumadocs-ui`, a component library with strong opinions about layout and styling. For a personal portfolio/blog, unique design expression matters more than out-of-the-box polish. Our custom stack gives us:

- Full control over every component
- No need to override or fight against framework defaults
- Design system that evolves with our needs

### 2. Minimal Dependencies

Fumadocs brings a significant dependency tree:

```
fumadocs-core    — Core utilities, plugins, search
fumadocs-mdx     — MDX integration, content source
fumadocs-ui      — React components, layouts
  └── @fumadocs/ui — Internal UI package
```

Our stack is leaner:

```
next-mdx-remote  — MDX compilation
rehype-pretty-code + shiki — Syntax highlighting  
remark-gfm       — GFM support
```

### 3. Long-term Maintainability

| Concern | Fumadocs | Custom Stack |
|---------|----------|--------------|
| Breaking changes | Dependent on Fumadocs releases | Control our own upgrade path |
| Next.js compatibility | Wait for Fumadocs updates | Update directly |
| Debugging | Need to understand Fumadocs internals | Direct access to all code |
| Migration | Coupled to Fumadocs conventions | Standard remark/rehype plugins, portable |

### 4. Learning & Understanding

Building the stack ourselves means:
- Deep understanding of the MDX ecosystem
- Transferable knowledge (remark/rehype work across frameworks)
- Easier onboarding for contributors

### 5. Feature Fit

Fumadocs excels at documentation sites with:
- Versioned docs
- Search (Flexsearch, Algolia)
- API reference generation
- Sidebar navigation

For a personal blog/portfolio, we don't need most of these features. The complexity overhead isn't justified.

## When to Reconsider

Fumadocs might become worthwhile if:
- The `/docs` section grows to 50+ pages
- We need versioned documentation
- We need full-text search
- Multiple contributors need a standardized content structure

## References

- [next-mdx-remote](https://github.com/hashicorp/next-mdx-remote)
- [rehype-pretty-code](https://rehype-pretty-code.netlify.app/)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)
- [Shiki](https://shiki.matsu.io/)
