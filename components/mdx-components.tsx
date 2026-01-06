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
 * Note: This file is RSC-compatible. Client components (like HeadingWithLink)
 * are imported from separate files marked with "use client".
 *
 * @see app/globals.css - `.prose-article` section for all prose styling
 * @see docs/mdx.md - Documentation on MDX rendering
 */

import { CodeBlock } from "@/components/code-block";
import { HeadingWithLink } from "@/components/heading-link";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

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
function TableWrapper({ children }: { children: React.ReactNode }) {
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
  // Semantic overrides only - no styling
  a: SmartLink,
  code: InlineCode,
  pre: CodeBlock,
  table: TableWrapper,
  // HeadingWithLink is a client component for interactive copy-link functionality
  h1: (props) => <HeadingWithLink level={1} {...props} />,
  h2: (props) => <HeadingWithLink level={2} {...props} />,
  h3: (props) => <HeadingWithLink level={3} {...props} />,
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
