"use client";

import { useCommandPalette, useLocale } from "@/components/providers";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ConversationInput() {
  const { open } = useCommandPalette();
  const { locale } = useLocale();
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor effect
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Handle Space key to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no other interactive element is focused
      const target = e.target as HTMLElement;
      const isInteractive = ["INPUT", "TEXTAREA", "BUTTON", "A"].includes(target.tagName);
      
      if (e.code === "Space" && !e.repeat && !isInteractive) {
        e.preventDefault();
        open();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const promptText = locale === "en" ? "what brings you here?" : "你为何而来？";

  return (
    <div className="w-full flex flex-col items-center gap-4 animate-in slide-in-from-bottom-8 fade-in duration-1000 delay-500">
      <label className="text-muted-foreground font-serif italic text-lg">
        {promptText}
      </label>
      
      <button
        onClick={() => open()}
        className={cn(
          "relative group w-full max-w-sm h-12 px-4 rounded-xl",
          "flex items-center justify-center",
          "bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50",
          "transition-all duration-300 ease-out",
          "focus:outline-none focus:ring-1 focus:ring-border"
        )}
      >
        <span className="w-4 h-0.5 bg-foreground/50 rounded-full animate-pulse mr-1" />
        <span 
          className={cn(
            "w-2.5 h-5 bg-foreground/50 block transition-opacity duration-150",
            showCursor ? "opacity-100" : "opacity-0"
          )} 
        />
      </button>
      
      <div className="text-xs text-muted-foreground/50 font-mono mt-2">
        {locale === "en" ? "press space or click to start" : "按空格或点击开始"}
      </div>
    </div>
  );
}
