import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import rehypePrettyCode, { type Options as PrettyCodeOptions } from "rehype-pretty-code";
import remarkGfm from "remark-gfm";

/**
 * MDX options for server-side rendering with next-mdx-remote/rsc
 * Includes syntax highlighting via Shiki and GFM table support
 */
export const mdxOptions: MDXRemoteProps["options"] = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      [
        rehypePrettyCode as unknown as Parameters<typeof Array.prototype.push>[0],
        {
          theme: "github-dark",
          keepBackground: true,
          defaultLang: "plaintext",
          // Prevent empty lines from collapsing
          onVisitLine(node: { properties: Record<string, unknown>; children: unknown[] }) {
            if (node.children.length === 0) {
              node.children = [{ type: "text", value: " " }];
            }
          },
          // Add class for highlighted lines (e.g., ```js {1,3-5})
          onVisitHighlightedLine(node: { properties: Record<string, unknown> }) {
            const className = node.properties.className as string[] | undefined;
            node.properties.className = [...(className ?? []), "line--highlighted"];
          },
          // Add class for highlighted words (e.g., ```js /word/)
          onVisitHighlightedChars(node: { properties: Record<string, unknown> }) {
            node.properties.className = ["word--highlighted"];
          },
        } satisfies PrettyCodeOptions,
      ],
    ],
  },
};
