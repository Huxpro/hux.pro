"use client";

import { cn } from "@/lib/utils";
import type { LabType } from "@/lib/content";
import { labDemos } from "./registry";

interface StageProps {
  slug: string;
  type: LabType;
  href?: string;
  title: string;
  className?: string;
}

/**
 * Stage — the embedded "canvas" at the top of a lab detail page.
 *
 * - inline: mounts the live React demo registered for this slug
 * - embed:  renders a sandboxed <iframe> of `href`
 *
 * External items never reach a detail page, so they don't render a Stage.
 */
export function Stage({ slug, type, href, title, className }: StageProps) {
  const frame = cn(
    "relative w-full overflow-hidden rounded-2xl border border-border bg-muted/30",
    className
  );

  if (type === "embed" && href) {
    return (
      <div className={frame}>
        <iframe
          src={href}
          title={title}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
          className="h-[460px] w-full"
        />
      </div>
    );
  }

  const Demo = labDemos[slug];
  if (Demo) {
    return (
      <div className={cn(frame, "p-4 sm:p-6")}>
        <Demo />
      </div>
    );
  }

  // Inline item with no registered demo yet — graceful placeholder.
  return (
    <div
      className={cn(
        frame,
        "flex h-72 items-center justify-center text-sm text-muted-foreground"
      )}
    >
      Demo coming soon
    </div>
  );
}
