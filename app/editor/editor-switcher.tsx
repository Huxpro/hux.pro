"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EDITORS } from "./editors";

/**
 * The editor-identity label, top-left in every editor's toolbar — now a
 * dropdown that switches between the source-of-truth editors under /editor.
 */
export function EditorSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = EDITORS.find((e) => e.id === current);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-sm font-medium tracking-wide transition-colors hover:bg-muted/20"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {active?.file ?? "editor"}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border/60 bg-popover p-1 shadow-overlay"
        >
          <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            editors · source of truth
          </div>
          {EDITORS.map((e) => (
            <Link
              key={e.id}
              href={e.href}
              onClick={() => setOpen(false)}
              role="menuitem"
              className={cn(
                "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                e.id === current ? "bg-muted/40" : "hover:bg-muted/20"
              )}
            >
              <Check
                className={cn(
                  "mt-0.5 h-3 w-3 shrink-0",
                  e.id === current ? "text-foreground" : "text-transparent"
                )}
              />
              <span className="min-w-0">
                <span className="block font-mono text-xs text-foreground">
                  {e.file}
                </span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {e.blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
