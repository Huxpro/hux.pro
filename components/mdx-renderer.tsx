import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxComponents } from "./mdx-components";
import { mdxOptions } from "@/lib/mdx-processor";

interface MDXRendererProps {
  source: string;
}

/**
 * Server Component that renders MDX content with:
 * - Shiki syntax highlighting
 * - GFM tables support
 * - Custom styled components
 */
export function MDXRenderer({ source }: MDXRendererProps) {
  return (
    <MDXRemote
      source={source}
      options={mdxOptions}
      components={mdxComponents}
    />
  );
}
