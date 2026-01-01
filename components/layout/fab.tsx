"use client";

import { useCommandPalette } from "@/components/providers";
import { cn } from "@/lib/utils";
import { Command } from "lucide-react";

export function FloatingActionButton() {
  const { open } = useCommandPalette();

  return (
    <button
      onClick={() => open()}
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "flex items-center justify-center gap-1.5",
        "rounded-full",
        "bg-foreground text-background",
        "shadow-lg shadow-black/20",
        "transition-all duration-200",
        "hover:scale-105 hover:shadow-xl",
        "active:scale-95",
        // Mobile: icon only
        "h-12 w-12",
        // Desktop: show ⌘K
        "md:h-10 md:w-auto md:px-4 md:rounded-full"
      )}
      aria-label="Open command palette"
    >
      <Command className="h-4 w-4 md:h-3.5 md:w-3.5" />
      <span className="hidden md:inline text-sm font-medium">K</span>
    </button>
  );
}
