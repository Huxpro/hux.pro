import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import React from "react";

type PlaygroundProps = {
  /**
   * Expected MDX shape:
   *
   * <Playground>
   * ```tsx
   * // source code
   * ```
   * <SomeComponent />
   * </Playground>
   *
   * The fenced code block will render as a `pre` which is mapped to `CodeBlock`
   * in `components/mdx-components.tsx`.
   */
  children: ReactNode;
  className?: string;
  /**
   * Max height for the source code pane. Long code becomes scrollable.
   * Accepts any valid CSS length (e.g. "420px", "40vh").
   */
  codeMaxHeight?: string;
};

function isWhitespaceTextNode(node: unknown): node is string {
  return typeof node === "string" && node.trim().length === 0;
}

function isLikelyMdxCodeBlockElement(node: unknown): boolean {
  if (!React.isValidElement(node)) return false;
  const props = node.props as Record<string, unknown>;

  // `rehype-pretty-code` wraps code blocks with:
  // <figure data-rehype-pretty-code-figure> ... <pre ... />
  // When `pre` is mapped to our `CodeBlock`, the `<figure>` becomes the top-level node.
  if (props["data-rehype-pretty-code-figure"] != null) return true;

  // `CodeBlock` (MDX-mapped `pre`) receives these data- props from the MDX pipeline.
  if (typeof props["data-language"] === "string" || typeof props["data-theme"] === "string") return true;

  // Fallback: if this node contains a nested <pre data-language|data-theme>, treat it as the code block.
  const stack: unknown[] = [props.children];
  while (stack.length) {
    const current = stack.pop();
    if (current == null) continue;
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
      continue;
    }
    if (!React.isValidElement(current)) continue;
    const childProps = current.props as Record<string, unknown>;
    if (
      current.type === "pre" &&
      (typeof childProps["data-language"] === "string" || typeof childProps["data-theme"] === "string")
    ) {
      return true;
    }
    stack.push(childProps.children);
  }

  return false;
}

export function Playground({ children, className, codeMaxHeight = "420px" }: PlaygroundProps) {
  const nodes = React.Children.toArray(children).filter((n) => !isWhitespaceTextNode(n));

  const codeIndex = nodes.findIndex(isLikelyMdxCodeBlockElement);
  const code = codeIndex >= 0 ? nodes[codeIndex] : null;

  const previewNodes =
    codeIndex >= 0 ? nodes.slice(0, codeIndex).concat(nodes.slice(codeIndex + 1)) : nodes;

  return (
    <div
      className={cn(
        // Match default vertical rhythm of code blocks in prose.
        "my-6",
        "playground overflow-hidden rounded-xl border border-border",
        className
      )}
    >
      <div
        className={cn(
          // Remove CodeBlock's outer wrapper spacing when used in Playground.
          "[&_figure]:!my-0 [&_figure>div]:!my-0",
          // Make the source pane scrollable for long code.
          "[&_pre]:!my-0 [&_pre]:overflow-auto",
          // Avoid nested borders/radius fighting the outer container.
          // Outer container provides the frame; the code block becomes “frameless”.
          "[&_pre]:!rounded-none [&_pre]:!border-0"
        )}
        style={{ ["--playground-code-max-height" as string]: codeMaxHeight }}
      >
        <div className="[&_pre]:max-h-[var(--playground-code-max-height)]">{code}</div>
      </div>

      {/* Thin divider between source & output */}
      <div aria-hidden className="border-t border-border/60" />

      <div
        className={cn(
          "min-h-[3rem] w-full p-4",
          // In prose context, embedded components are wrapped with `.not-prose`
          // which gets `my-6`. Inside Playground it reads like extra padding,
          // so we neutralize it for consistent spacing.
          "[&_.not-prose]:!my-0"
        )}
      >
        {previewNodes}
      </div>
    </div>
  );
}

