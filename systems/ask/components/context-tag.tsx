"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { Briefcase, Code2, FileText, Paperclip, Quote, TextQuote, X } from "lucide-react";
import type { AskContext } from "../lib/tools";
import { askStrings } from "../strings";

// =============================================================================
// A context as a tag: over the composer, what the next question will be
// about (the page open, ../lib/page-context.ts), with × to leave it out; on
// a sent question, what it was asked about, as a link back to it.
// =============================================================================

function IconOf({ context }: { context: Pick<AskContext, "kind" | "doc"> }) {
  const className = "size-3 shrink-0";
  if (context.kind === "quote") return <TextQuote className={className} />;
  if (context.kind === "item") return <Paperclip className={className} />;
  const kind = context.doc?.split(":")[0];
  if (kind === "work") return <Briefcase className={className} />;
  if (kind === "conviction" || kind === "influence") return <Quote className={className} />;
  if (kind === "language") return <Code2 className={className} />;
  return <FileText className={className} />;
}

export function ContextTag({
  context,
  onRemove,
  className,
}: {
  context: Pick<AskContext, "kind" | "doc" | "title" | "href" | "heading">;
  /** Leave it out of the question (the composer's tag). */
  onRemove?: () => void;
  className?: string;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const label = (
    <>
      {context.title}
      {context.heading && <span className="text-tertiary-foreground"> · {context.heading}</span>}
    </>
  );
  return (
    <span
      data-ask-context={context.kind}
      title={onRemove ? undefined : s.contextSent}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/50 pl-1.5 text-xs text-muted-foreground",
        onRemove ? "pr-0.5" : "pr-2",
        className,
      )}
    >
      <IconOf context={context} />
      {/* On a sent question, a link back (followed by Ask's link handler);
          over the composer, where nothing follows links, just the name. */}
      {onRemove ? (
        <span className="min-w-0 truncate">{label}</span>
      ) : (
        <a href={context.href} className="min-w-0 truncate hover:text-foreground">
          {label}
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={s.contextRemove}
          title={s.contextRemove}
          className="pressable flex size-5 shrink-0 items-center justify-center rounded hover:bg-background hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
