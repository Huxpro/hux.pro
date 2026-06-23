"use client";

import { motion } from "motion/react";

/**
 * Wave — a minimal, self-animating demo.
 *
 * A row of dots bobbing in a traveling sine wave. No interaction required: it
 * reads as alive at rest, which makes it a good default for the home widget's
 * "tinkering" slot. Theme-aware, so it sits well in both light and dark.
 */
const DOTS = 11;

export function WaveDemo() {
  return (
    <div className="flex h-full min-h-[11rem] w-full items-center justify-center overflow-hidden rounded-2xl bg-muted/40">
      <div className="flex items-center gap-2">
        {Array.from({ length: DOTS }).map((_, i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-foreground/70"
            animate={{ y: [-7, 7, -7] }}
            transition={{
              duration: 1.4,
              ease: "easeInOut",
              repeat: Infinity,
              delay: (i / DOTS) * 1.4,
            }}
          />
        ))}
      </div>
    </div>
  );
}
