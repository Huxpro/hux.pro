/**
 * MDX Components - Context-less, Style-free
 *
 * IMPORTANT CONVENTION:
 * This file provides semantic/logic overrides for MDX elements ONLY.
 * All visual styling is handled by CSS in `app/globals.css` via the
 * `.prose-article` class wrapper.
 *
 * Why this separation?
 * 1. Single source of truth for typography (CSS)
 * 2. MDX components can be reused in different contexts with different styles
 * 3. Easier to maintain and iterate on design
 * 4. Avoids specificity conflicts between Tailwind classes and CSS
 *
 * What belongs here:
 * - Semantic logic (e.g., external link detection for <a>)
 * - Custom components (e.g., CodeBlock with syntax highlighting)
 * - Structural wrappers (e.g., table scroll container)
 *
 * What does NOT belong here:
 * - Typography styles (font-size, font-weight, margins, colors)
 * - Visual styling (backgrounds, borders, spacing)
 *
 * Component Categories:
 * 1. HTML Element Overrides (lowercase) - get prose styles from .prose-article
 * 2. Custom Embed Components (capitalized) - wrapped with .not-prose to escape prose styles
 *
 * Note: This file is RSC-compatible. Client components (like HeadingWithLink)
 * are imported from separate files marked with "use client".
 *
 * @see app/globals.css - `.prose-article` and `.not-prose` sections
 * @see docs/mdx.md - Documentation on MDX rendering
 */

import { CodeBlock } from "@/components/code-block";
import { HeadingWithLink } from "@/components/heading-link";
import { MdxImage } from "@/components/mdx-image";
import { HStackWidget, VStackWidget } from "@/components/home/featured-stack-widget";
import { Playground } from "@/components/playground";
import {
  WidgetShell,
  WidgetHeader,
  WidgetTitle,
  WidgetBody,
  WidgetLink,
  WidgetStatus,
} from "@/components/ui/widget";
import {
  Commit,
  Media,
  Video,
  SocialEmbed,
  Link as MediaLink,
  LinkCard,
  Figure,
  MediaRenderer,
} from "@/components/log";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ComponentType, ReactNode } from "react";

// =============================================================================
// Prose Escape Wrapper
// =============================================================================

/**
 * HOC that wraps a component with .not-prose to escape prose styling.
 *
 * Spacing is handled by CSS rules in globals.css:
 * - .prose-article .not-prose { margin } - first-level gets margin
 * - .not-prose .not-prose { margin: 0 } - nested elements reset margin
 *
 * This allows components to be used standalone or nested in stacks without
 * double margin issues, keeping spacing logic in CSS rather than React.
 *
 * @see app/globals.css - .not-prose spacing rules
 */
function withNotProse<P extends object>(Component: ComponentType<P>) {
  function WrappedComponent(props: P) {
    return (
      <div className="not-prose">
        <Component {...props} />
      </div>
    );
  }
  WrappedComponent.displayName = `withNotProse(${Component.displayName || Component.name || "Component"})`;
  return WrappedComponent;
}

/**
 * Inline code component
 * Distinguishes between inline `code` and code inside <pre> blocks
 */
function InlineCode({ children, ...props }: ComponentPropsWithoutRef<"code">) {
  const hasLanguage = (props as { "data-language"?: string })["data-language"];

  // If it has data-language, it's inside a pre block - render as-is (styled by CSS)
  if (hasLanguage) {
    return <code {...props}>{children}</code>;
  }

  // Inline code - no styling here, handled by .prose-article code in CSS
  return <code {...props}>{children}</code>;
}

/**
 * Link component with external link detection
 * External links open in new tab with security attributes
 */
function SmartLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href || ""} {...props}>
      {children}
    </Link>
  );
}

/**
 * Table wrapper for horizontal scroll on small screens
 */
function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="prose-table-wrapper">
      <table>{children}</table>
    </div>
  );
}

/**
 * Shared MDX component definitions
 * Used by both useMDXComponents (for @next/mdx) and mdxComponents (for next-mdx-remote)
 */
const sharedComponents: MDXComponents = {
  // ---------------------------------------------------------------------------
  // HTML Element Overrides (prose styles apply from .prose-article CSS)
  // ---------------------------------------------------------------------------
  a: SmartLink,
  code: InlineCode,
  pre: CodeBlock,
  table: TableWrapper,
  // Auto-decides "bleed out" from intrinsic dimensions; override per image
  // with a #bleed / #no-bleed URL fragment. @see components/mdx-image.tsx
  img: MdxImage,
  // HeadingWithLink is a client component for interactive copy-link functionality
  h1: (props) => <HeadingWithLink level={1} {...props} />,
  h2: (props) => <HeadingWithLink level={2} {...props} />,
  h3: (props) => <HeadingWithLink level={3} {...props} />,

  // ---------------------------------------------------------------------------
  // Commit Components (work items)
  // Components handle their own visual styling via variant props
  // ---------------------------------------------------------------------------
  Commit: withNotProse(Commit),
  HStackWidget: withNotProse(HStackWidget),
  VStackWidget: withNotProse(VStackWidget),

  // ---------------------------------------------------------------------------
  // Media Components
  // - Media: Unified entry point (auto-detects kind from URL)
  // - Video: YouTube / Bilibili / Vimeo players
  // - SocialEmbed: Native social widgets (X / Instagram / TikTok)
  // - Link: External link pill
  // - LinkCard: OG-style preview card (backed by the card pipeline)
  // - Figure: Static image display (uses Next.js Image)
  // - MediaRenderer: Orchestrates multiple media items
  // ---------------------------------------------------------------------------
  Media: withNotProse(Media),
  Video: withNotProse(Video),
  SocialEmbed: withNotProse(SocialEmbed),
  Link: withNotProse(MediaLink),
  LinkCard: withNotProse(LinkCard),
  Figure: withNotProse(Figure),
  MediaRenderer: withNotProse(MediaRenderer),

  // ---------------------------------------------------------------------------
  // Widget Primitives (shadcn-like composable building blocks)
  // ---------------------------------------------------------------------------
  WidgetShell: withNotProse(WidgetShell),
  WidgetHeader,
  WidgetTitle,
  WidgetBody,
  WidgetLink,
  WidgetStatus,

  // ---------------------------------------------------------------------------
  // Docs: live code + preview playground
  // ---------------------------------------------------------------------------
  // NOTE: Do NOT wrap with `.not-prose` — we want prose code styles (Shiki vars)
  // to apply to the source pane.
  Playground,
};

/**
 * For @next/mdx integration
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...sharedComponents,
    ...components,
  };
}

/**
 * For next-mdx-remote integration
 */
export const mdxComponents: MDXComponents = sharedComponents;
