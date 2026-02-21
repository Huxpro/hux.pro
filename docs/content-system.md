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

### URL Behavior (Route-based Locale)

Each language version has its own statically generated route:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BILINGUAL URL HANDLING                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /writing/my-post/en       → English version (static HTML)         │
│  /writing/my-post/zh       → Chinese version (static HTML)         │
│  /writing/my-post          → Middleware redirect → /{cookie locale} │
│                                                                     │
│  When route locale ≠ system locale (shared link scenario):         │
│    → Non-blocking toast asks user to choose language               │
│  When user clicks the language switcher:                           │
│    → Feedback toast: "Viewing in X · Preference unchanged"         │
│                                                                     │
│  Single-language posts generate one route only:                    │
│    /writing/en-only-post/en  (no /zh route exists)                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why route-based instead of `?lang=` query params:**
- Full static HTML per language — SEO crawlers see real content, not a Suspense skeleton
- Build-time MDX error catching (no Suspense deferral hiding compilation failures)
- Smaller payloads — only the requested language's MDX is rendered server-side
- Proper `hreflang` alternate links via `generateMetadata`

**Key infrastructure:**
- `middleware.ts` — redirects bare URLs by reading the `locale` cookie (synced from localStorage by the locale service); falls back to `defaultLocale` ("en")
- `getPostHref()` — all internal links must use this helper, which returns `/{locale}` for bilingual posts and `/{post.language}` for single-language posts
- `usePostLanguage()` — manages conflict/switch toasts; uses `hydrated` flag from `LocaleProvider` to wait for real system locale, and `sessionStorage` to distinguish intentional switches from shared-link conflicts across route navigations

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
next-mdx-remote/rsc (server-side compilation, blockJS: false)
    ├── remark-gfm (tables, GFM features)
    └── rehype-pretty-code (syntax highlighting)
    ↓
React components (custom MDX components)
    ↓
Static HTML (one page per locale)
```

**`blockJS: false`**: next-mdx-remote v6 defaults to `blockJS: true`, which strips JSX attribute expressions like `commit={{...}}` and `defaultExpanded={true}` while keeping string literals. Since all MDX is trusted first-party content, we disable this sandboxing. Without it, components receiving object/boolean props get `undefined`.

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

Each locale gets its own statically generated page:

```
Route structure:
  app/writing/[slug]/[lang]/page.tsx   → /writing/my-post/en, /writing/my-post/zh
  app/writing/[slug]/page.tsx          → redirect to /writing/my-post/{defaultLocale}
  app/docs/[...slug]/page.tsx          → /docs/my-doc/en (locale is last catch-all segment)
```

```typescript
// Bilingual posts generate two pages; mono-lingual posts generate one
export function generateStaticParams() {
  return slugs.flatMap((slug) => {
    const post = getPost(slug);
    if (post.language === "both") {
      return locales.map((lang) => ({ slug, lang }));
    }
    return [{ slug, lang: post.language }];
  });
}

// Server component renders ONE language's MDX (not both)
export default async function BlogPostLangPage({ params }) {
  const { slug, lang } = await params;
  const post = getBlogPostBySlug(slug);
  const content = lang === "zh" && post.contentZh ? post.contentZh : post.content;
  return (
    <BlogPostContent locale={lang} language={post.language}>
      <MDXRenderer source={content} />
    </BlogPostContent>
  );
}
```

### Key Files

| File | Purpose |
|------|---------|
| `app/writing/[slug]/[lang]/page.tsx` | Per-locale static blog pages with `generateMetadata` (hreflang) |
| `app/writing/[slug]/page.tsx` | Redirect stub for bare `/writing/slug` URLs |
| `app/docs/[...slug]/page.tsx` | Docs page; parses locale from last catch-all segment |
| `middleware.ts` | Redirects bare URLs to `/{cookie locale}` (307) |

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
