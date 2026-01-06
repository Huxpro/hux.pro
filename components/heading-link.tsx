"use client";

import { cn } from "@/lib/utils";
import { Link as LinkIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generate a URL-friendly ID from heading text
 */
function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff-]/g, "") // Keep Chinese characters, alphanumeric, spaces, hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();
}

/**
 * Heading component with hash link on hover
 * Client component for interactive copy-link functionality
 */
export function HeadingWithLink({
  level,
  children,
  ...props
}: {
  level: 1 | 2 | 3;
  children: React.ReactNode;
} & ComponentPropsWithoutRef<"h1" | "h2" | "h3">) {
  const [isCopied, setIsCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [id, setId] = useState("");

  // Extract text content from DOM after render
  useEffect(() => {
    if (headingRef.current) {
      const textContent = headingRef.current.textContent || "";
      setId(generateHeadingId(textContent));
    }
  }, [children]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!id) return;
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard.writeText(url).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        // Also update URL without scrolling
        window.history.pushState(null, "", `#${id}`);
      });
    },
    [id]
  );

  const HeadingTag = `h${level}` as "h1" | "h2" | "h3";

  return (
    <HeadingTag
      ref={headingRef}
      id={id || undefined}
      {...props}
      className={cn(
        "group cursor-pointer inline-flex items-center gap-2",
        props.className
      )}
      onClick={handleClick}
    >
      <span>{children}</span>
      {id && (
        <button
          onClick={handleClick}
          className={cn(
            "inline-flex items-center transition-all opacity-0 group-hover:opacity-100",
            "text-muted-foreground hover:text-foreground",
            "focus:opacity-100 focus:outline-none"
          )}
          aria-label="Copy link to heading"
        >
          {isCopied ? (
            <span className="text-xs text-green-500">✓</span>
          ) : (
            <LinkIcon className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </HeadingTag>
  );
}
