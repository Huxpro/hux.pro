"use client";

import { HeaderAction } from "@/components/ui/controls";
import { TYPE } from "@/lib/typography";
import { localeNames, useLocale } from "@/services";
import { Languages } from "lucide-react";

/**
 * The About in the other language, a press away. The About is the first
 * thing a visitor meets, often in the language their browser guessed; one
 * press puts it in the one they read.
 *
 * It belongs to the words, not the screen (about-surface.tsx): on a desk at
 * their bottom-right, closing the foot's row whose left is the way out; on
 * a phone at their top-right, level with the greeting, scrolling away with
 * them (the foot's middle is the way out's). The article's own switch
 * (post-content.tsx): the meta row's mono, the Languages glyph, a chip that
 * only paints under a pointer.
 */
export function AboutLanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const other = locale === "zh" ? "en" : "zh";
  return (
    <span className={TYPE.meta}>
      <HeaderAction
        variant="action"
        onClick={() => setLocale(other)}
        label={locale === "zh" ? "Read in English" : "切换到中文"}
      >
        <Languages className="h-3 w-3" />
        <span lang={other}>{localeNames[other]}</span>
      </HeaderAction>
    </span>
  );
}
