# Content System

The content system powers the blog and documentation with bilingual MDX content.

## Content Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CONTENT STRUCTURE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   content/                                                          │
│   ├── blog/                    # Blog posts                         │
│   │   ├── my-post.en.mdx       # English version                    │
│   │   ├── my-post.zh.mdx       # Chinese version                    │
│   │   └── post-with-assets/    # Directory-based post               │
│   │       ├── index.en.mdx                                          │
│   │       ├── index.zh.mdx                                          │
│   │       └── diagram.png      # Co-located assets                  │
│   ├── talks/                   # Talk transcripts                   │
│   └── docs/                    # This documentation                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Bilingual Content

### Language Detection

**Language is derived from filename, not frontmatter.** Files must follow the `[slug].[lang].mdx` convention:

| File Structure | Derived Language | Behavior |
|----------------|------------------|----------|
| `slug.en.mdx` only | `"en"` | English-only post |
| `slug.zh.mdx` only | `"zh"` | Chinese-only post |
| `slug.en.mdx` + `slug.zh.mdx` | `"both"` | True bilingual post |

### URL Behavior

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BILINGUAL URL HANDLING                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /blog/my-post          → Uses system locale                        │
│  /blog/my-post?lang=zh  → Forces Chinese (shareable URL)           │
│  /blog/my-post?lang=en  → Forces English (shareable URL)           │
│                                                                     │
│  When ?lang= conflicts with system locale:                          │
│    → Dialog asks user to choose preferred language                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Filtering Logic

| Post Type | English UI | Chinese UI |
|-----------|------------|------------|
| English-only | Shown | Hidden (checkbox to include) |
| Chinese-only | Hidden (checkbox to include) | Shown |
| Bilingual | Primary: EN, "Also in 中文" | Primary: ZH, "Also in English" |

Key utilities:
- `shouldShowPost()` - Filters posts based on locale and preference
- `validateBlogContent()` - Validates file naming during build

## MDX Processing

### Pipeline

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

### Stack

| Package | Purpose |
|---------|---------|
| `next-mdx-remote` | Server-side MDX compilation with RSC support |
| `rehype-pretty-code` | Shiki-based syntax highlighting |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) |
| `shiki` | Syntax highlighting engine |
| `gray-matter` | Frontmatter parsing |

### Key Files

| File | Purpose |
|------|---------|
| `lib/mdx-processor.ts` | MDX options configuration with plugins |
| `components/mdx-renderer.tsx` | Server component that renders MDX |
| `components/mdx-components.tsx` | Semantic/logic overrides |
| `app/globals.css` | All prose styling (`.prose-article` section) |

### Styling Convention

MDX components are **context-less** — they contain no visual styling:

| Concern | Location | Example |
|---------|----------|---------|
| **Typography** | `app/globals.css` | Font sizes, margins, colors |
| **Visual styling** | `app/globals.css` | Backgrounds, borders, spacing |
| **Semantic logic** | `mdx-components.tsx` | External link detection |
| **Custom components** | `mdx-components.tsx` | `CodeBlock`, table wrapper |

This separation allows MDX components to be reused across different contexts.

## Features

### Syntax Highlighting

Code blocks use Shiki with the `github-dark` theme:

- **Line highlighting**: ` ```js {1,3-5} `
- **Word highlighting**: ` ```js /word/ `
- **Diff syntax**: Lines starting with `+` or `-`
- **Language badge**: Displayed in top-right corner

### GFM Support

| Feature | Supported |
|---------|-----------|
| Tables | ✅ |
| Strikethrough | ✅ |
| Task lists | ✅ |
| Autolinks | ✅ |

### Custom Components

MDX elements receive semantic overrides:
- **Links**: External link detection (opens in new tab)
- **Code**: Inline vs block code detection
- **Tables**: Horizontal scroll wrapper

## Static Generation

Blog posts are statically generated at build time:

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

## Why Not Fumadocs?

We evaluated [Fumadocs](https://fumadocs.vercel.app/) but chose a custom stack for:

1. **Design Independence** - Full control over every component
2. **Minimal Dependencies** - Leaner stack with standard remark/rehype plugins
3. **Long-term Maintainability** - Direct control over upgrade path
4. **Feature Fit** - We don't need versioned docs, search, or API reference generation

Reconsider Fumadocs if:
- `/docs` grows to 50+ pages
- We need versioned documentation
- We need full-text search
