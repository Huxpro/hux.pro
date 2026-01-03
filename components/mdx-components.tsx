import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { CodeBlock } from "@/components/code-block";

/**
 * Inline code component (not in a code block)
 */
function InlineCode({ children, ...props }: ComponentPropsWithoutRef<"code">) {
  // rehype-pretty-code wraps code blocks in <pre><code>,
  // but inline code is just <code> without data-language
  const hasLanguage = (props as { "data-language"?: string })["data-language"];

  // If it has data-language, it's inside a pre block - render as-is
  if (hasLanguage) {
    return <code {...props}>{children}</code>;
  }

  // Otherwise it's inline code
  return (
    <code
      className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono text-foreground/90"
      {...props}
    >
      {children}
    </code>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Override default elements with custom styling
    h1: ({ children }) => (
      <h1 className="text-3xl font-semibold tracking-tight mt-12 mb-4 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-2xl font-semibold tracking-tight mt-10 mb-4">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="leading-relaxed mb-4 text-foreground/90">{children}</p>
    ),
    a: ({ href, children }) => {
      const isExternal = href?.startsWith("http");
      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
          >
            {children}
          </a>
        );
      }
      return (
        <Link
          href={href || ""}
          className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
        >
          {children}
        </Link>
      );
    },
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-6 mb-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-6 mb-4 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed text-foreground/90">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border pl-4 my-4 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-8 border-border" />,
    // Code components with syntax highlighting support
    code: InlineCode,
    pre: CodeBlock,
    // Enhanced table styling
    table: ({ children }) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-border">
        <table className="w-full border-collapse text-sm !my-0">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }) => (
      <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
        {children}
      </tr>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-foreground/90">{children}</td>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    ...components,
  };
}

// Export the components for use with next-mdx-remote
// This uses the same components as useMDXComponents
export const mdxComponents: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-semibold tracking-tight mt-12 mb-4 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-semibold tracking-tight mt-10 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xl font-semibold tracking-tight mt-8 mb-3">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="leading-relaxed mb-4 text-foreground/90">{children}</p>
  ),
  a: ({ href, children }) => {
    const isExternal = href?.startsWith("http");
    if (isExternal) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={href || ""}
        className="text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
      >
        {children}
      </Link>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc list-outside ml-6 mb-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside ml-6 mb-4 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed text-foreground/90">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-4 my-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  // Code components with syntax highlighting support
  code: InlineCode,
  pre: CodeBlock,
  // Enhanced table styling
  table: ({ children }) => (
    <div className="overflow-x-auto my-6 rounded-lg border border-border">
      <table className="w-full border-collapse text-sm !my-0">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-border px-4 py-3 text-left font-semibold text-foreground">
      {children}
    </th>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      {children}
    </tr>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-foreground/90">{children}</td>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
};
