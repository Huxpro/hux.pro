"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import { useDock } from "../provider";

// ---------------------------------------------------------------------------
// LiveActivity — the shared collapsed-pill ⇄ expanded-panel morph.
//
// This is the canonical "Global Player" UI, extracted so every dock activity
// (music, ambient phase changes, …) is visually identical. Callers supply only
// the *content*:
//   • `pill`   — leading content of the collapsed pill (icon, art, EQ bars…)
//   • `title`  — left side of the expanded panel header
//   • children — the expanded panel body
//
// Open/close state, the scrim, Esc and route-change collapse all live in the
// Dock coordination layer (see provider.tsx). Per the product spec, expanding
// any activity hides every pill; collapsing restores them.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

interface LiveActivityProps {
  /** Stable id; the Dock allows only one activity open at a time. */
  id: string;
  /** Leading content inside the collapsed pill (before the chevron). */
  pill: React.ReactNode;
  /** Panel header content (left side, before the collapse chevron). */
  title: React.ReactNode;
  /** Panel body. */
  children: React.ReactNode;
  /** aria-label for the collapsed pill button. */
  openLabel: string;
  /** aria-label for the collapse button. */
  collapseLabel: string;
  /** Extra classes for the collapsed pill. */
  pillClassName?: string;
  /** Extra classes for the expanded panel (e.g. widget-matched radius). */
  panelClassName?: string;
}

export function LiveActivity({
  id,
  pill,
  title,
  children,
  openLabel,
  collapseLabel,
  pillClassName,
  panelClassName,
}: LiveActivityProps) {
  const { isOpen, isAnyOpen, open, close, registerActivity } = useDock();
  const expanded = isOpen(id);

  // If this activity unmounts while expanded (e.g. its time window passes),
  // collapse the dock so the scrim and pill-hiding don't get stuck.
  useEffect(() => registerActivity(id), [id, registerActivity]);

  return (
    <>
      {/* Collapsed pill — a flex item in the dock row. Hidden whenever ANY
          activity is expanded, so the open panel stands alone. */}
      <AnimatePresence>
        {!isAnyOpen && (
          <motion.button
            key="pill"
            onClick={() => open(id)}
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ transformOrigin: "top center" }}
            className={cn(
              "pointer-events-auto flex items-center gap-2 shrink-0",
              "h-9 pl-1.5 pr-2.5 rounded-full",
              "border border-border/50 bg-glass backdrop-blur-xl",
              "shadow-raised",
              "hover:border-border hover:bg-glass-hover transition-colors",
              "pressable active:border-border active:bg-glass-hover active:scale-95",
              pillClassName
            )}
            aria-label={openLabel}
          >
            {pill}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel — fixed-centered overlay. It lives in the DOM inside the
          (transform-free) dock row, so `fixed` stays anchored to the viewport
          and the pill→panel swap reads as one morph from the same anchor. */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="panel"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.4, bottom: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -40) close();
            }}
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{
              transformOrigin: "top center",
              top: "max(env(safe-area-inset-top), 0.5rem)",
            }}
            className={cn(
              "fixed left-1/2 z-50 -translate-x-1/2 pointer-events-auto",
              "w-[min(92vw,360px)] overflow-hidden",
              "rounded-2xl border border-border/50 bg-glass shadow-overlay backdrop-blur-xl",
              panelClassName,
            )}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <div className="flex items-center gap-2 min-w-0">{title}</div>
              <button
                onClick={close}
                className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
                aria-label={collapseLabel}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>

            {/* Body is padding-agnostic — each activity supplies content that
                already carries its own padding (a <NowPlaying /> wrapper, a
                full weather card, …) so the panel can host any widget body. */}
            {children}

            {/* Grabber — swipe up to collapse */}
            <div className="flex justify-center pb-2">
              <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
