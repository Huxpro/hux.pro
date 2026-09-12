"use client";

import { useLocale, t } from "@/services";
import { useCommand } from "./provider";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Command, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDraggable } from "@/systems/draggable";

export function FloatingActionButton() {
  const { toggle } = useCommand();
  const pathname = usePathname();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const drag = useDraggable("command-fab");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isHomepage = pathname === "/";
  const isDraggable = drag.isEnabled && !isHomepage;

  if (!mounted) return null;

  const fab = (
    <div
      className={cn(
        "fixed bottom-6 left-0 right-0 z-50 px-6",
        "flex pointer-events-none",
        isHomepage ? "justify-center" : "justify-end"
      )}
    >
      <motion.button
        layout
        onClick={() => toggle()}
        className={cn(
          "pointer-events-auto",
          "flex items-center gap-2",
          "bg-glass backdrop-blur-xl",
          "border border-border/50",
          "shadow-raised",
          isHomepage ? "text-muted-foreground" : "text-foreground",
          "hover:bg-glass-hover hover:border-border transition-colors",
          "h-12",
          "overflow-hidden",
          isHomepage
            ? "rounded-2xl pl-4 pr-6 md:px-4 w-auto md:w-full md:max-w-md active:scale-[1] focus:outline-none focus:ring-2 focus:ring-ring/20"
            : "rounded-[24px] w-12 md:w-auto md:px-4 justify-center active:scale-95"
        )}
        style={{ borderRadius: isHomepage ? 24 : 24 }}
        transition={{
          layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
          borderRadius: { duration: 0.4 },
        }}
        aria-label="Open command palette"
      >
        <motion.div
          layout
          className="flex items-center justify-center shrink-0"
        >
          {isHomepage ? (
            <Search className="h-4 w-4" />
          ) : (
            <Command className="h-5 w-5 md:h-4 md:w-4" />
          )}
        </motion.div>

        <AnimatePresence mode="popLayout">
          {isHomepage && (
            <motion.span
              key="prompt-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: 1,
                x: 0,
                width: "auto",
                transition: { duration: 0.3, delay: 0.1 },
              }}
              exit={{
                opacity: 0,
                x: -10,
                transition: { duration: 0.2 },
              }}
              className="flex-1 text-left text-sm whitespace-nowrap overflow-hidden"
            >
              <span className="md:hidden">{t(locale, "searchMobile")}</span>
              <span className="hidden md:inline">
                {t(locale, "searchDesktop")}
              </span>
            </motion.span>
          )}

          {!isHomepage && (
            <motion.div
              key="fab-text"
              initial={{ opacity: 0, x: 10 }}
              animate={{
                opacity: 1,
                x: 0,
                width: "auto",
                transition: { duration: 0.3, delay: 0.1 },
              }}
              exit={{
                opacity: 0,
                x: 10,
                transition: { duration: 0.2 },
              }}
              className="hidden md:block overflow-hidden"
            >
              <span className="text-sm font-medium whitespace-nowrap">K</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isHomepage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              className="hidden sm:flex"
            >
              <kbd className="items-center gap-0.5 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded flex">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  if (!isDraggable) return fab;

  return (
    <motion.div
      style={{
        ...drag.motionStyle,
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      drag
      dragControls={drag.dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
    >
      <div
        ref={drag.contentRef as React.RefObject<HTMLDivElement>}
        style={{ pointerEvents: "auto", touchAction: "none" }}
        onPointerDown={(e) => drag.startDrag(e)}
        onClickCapture={drag.preventClickAfterDrag}
      >
        {fab}
      </div>
    </motion.div>
  );
}
