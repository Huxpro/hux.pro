"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { EDITORS, editorFromPath } from "./catalog";

/**
 * The top-left title on every `/editor` page: a dropdown that lists the
 * whole family. Toolbar pages (log.json, icon.json) keep the compact mono
 * mark; lab pages use the same control at title size so the door is one
 * control everywhere.
 */
export function EditorNav({
  appearance = "toolbar",
  className,
}: {
  appearance?: "toolbar" | "page";
  className?: string;
}) {
  const pathname = usePathname();
  const current = editorFromPath(pathname);
  const page = appearance === "page";

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "group inline-flex items-center gap-1 rounded-md text-left outline-none",
          "focus-visible:ring-1 focus-visible:ring-foreground/20",
          page
            ? "font-serif text-2xl tracking-tight text-foreground"
            : "font-mono text-sm font-medium tracking-wide text-foreground",
          className,
        )}
        aria-label={`Editors · ${current.title}`}
      >
        {current.title}
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150 group-data-[popup-open]:rotate-180",
            page ? "h-4 w-4" : "h-3 w-3",
          )}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Menu.Popup
            className={cn(
              "min-w-[16rem] origin-[var(--transform-origin)] rounded-xl border border-border/50",
              "bg-glass-sheet p-1 shadow-overlay backdrop-blur-xl",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
              "transition-[transform,opacity] duration-150",
            )}
          >
            {EDITORS.map((entry) => {
              const active = entry.id === current.id;
              return (
                <Menu.LinkItem
                  key={entry.id}
                  href={entry.href}
                  closeOnClick
                  render={<Link href={entry.href} />}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg px-2.5 py-1.5 outline-none",
                    "data-[highlighted]:bg-muted/40",
                    active && "bg-muted/25",
                  )}
                >
                  <span className="font-mono text-xs text-foreground">{entry.title}</span>
                  <span className="text-[11px] text-muted-foreground">{entry.hint}</span>
                </Menu.LinkItem>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
