"use client";

import type { NativeSurface } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import {
  Clapperboard,
  Image as ImageIcon,
  Music,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const MARKS: Record<NativeSurface, LucideIcon> = {
  watch: Clapperboard,
  music: Music,
  wallpaper: ImageIcon,
  writing: ScrollText,
  prompt: Sparkles,
};

/** The glyph a built-in app wears where an external app wears its icon. */
export function BuiltinMark({
  surface,
  className,
}: {
  surface: NativeSurface;
  className?: string;
}) {
  const Icon = MARKS[surface];
  return <Icon className={cn("text-neutral-700", className)} strokeWidth={1.75} />;
}
