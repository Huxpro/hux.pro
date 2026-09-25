"use client";

import { builtinApp } from "@/lib/builtin-apps";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { Shrink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWindows } from "../provider";

/**
 * Turn the page you're on into a window on the desktop.
 *
 * A fullscreen route (writing, a post, prompt) is the same app maximized.
 * Shrinking opens that app's native window and returns to the home surface,
 * which is the desktop the window floats on.
 */
export function ShrinkToWindow({ appId }: { appId: string }) {
  const { locale } = useLocale();
  const { openApp } = useWindows();
  const router = useRouter();
  const app = builtinApp(appId);
  if (!app) return null;

  const label = locale === "zh" ? "收成窗口" : "Shrink to window";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        openApp(app);
        router.push("/");
      }}
      className={cn(
        "system-chrome pressable inline-flex h-8 items-center gap-1.5 rounded-full px-2.5",
        "font-mono text-[10px] uppercase tracking-wider text-muted-foreground",
        "hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      <Shrink className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{locale === "zh" ? "窗口" : "Window"}</span>
    </button>
  );
}
