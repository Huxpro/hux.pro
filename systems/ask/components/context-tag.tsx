"use client";

import { quoteLabel } from "../lib/selection-layout";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { Briefcase, Code2, FileText, Paperclip, Quote, TextQuote, Plus, X } from "lucide-react";
import type { AskContext } from "../lib/tools";
import { askStrings } from "../strings";

// =============================================================================
// A context as a tag: over the composer, what the next question will be
// about (the page open, ../lib/page-context.ts), with × to leave it out; on
// a sent question, what it was asked about, as a link back to it.
// =============================================================================

const TAG_SHAPE = "inline-flex h-6 max-w-full items-center gap-1 rounded-md border pl-1.5 text-xs";

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
  onAdd,
  className,
}: {
  context: Pick<AskContext, "kind" | "doc" | "title" | "href" | "heading" | "text">;
  /** Leave it out of the question (the composer's tag). */
  onRemove?: () => void;
  /** An available context: the same badge, empty until added. */
  onAdd?: () => void;
  className?: string;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const label = context.kind === "quote" && context.text ? `“${quoteLabel(context.text)}”` : (
    <>
      {context.title}
      {context.heading && <span className="text-tertiary-foreground"> · {context.heading}</span>}
    </>
  );
  if (onAdd) {
    return (
      <button
        type="button"
        data-ask-context-empty={context.kind}
        onClick={onAdd}
        aria-label={`${s.contextRestore}: ${context.title}${context.heading ? ` · ${context.heading}` : ""}`}
        title={s.contextRestore}
        className={cn(TAG_SHAPE, "pressable border-dashed border-border/60 bg-transparent pr-1.5 text-tertiary-foreground hover:border-border hover:text-muted-foreground", className)}
      >
        <IconOf context={context} />
        <span className="min-w-0 truncate">{label}</span>
        <Plus className="size-3 shrink-0" />
      </button>
    );
  }
  return (
    <span
      data-ask-context={context.kind}
      title={context.kind === "quote" ? `${context.title}\n${context.text ?? ""}` : (onRemove ? undefined : s.contextSent)}
      className={cn(
        TAG_SHAPE,
        "border-border/60 bg-muted/50 text-muted-foreground",
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
