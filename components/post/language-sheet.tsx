"use client";

import type { Locale } from "@/services";
import { t } from "@/services";
import { cn } from "@/lib/utils";
import { AdaptiveSurface } from "@/systems/surface";
import { Languages } from "lucide-react";

// ---------------------------------------------------------------------------
// LanguageSharedSheet — a link shared in the other language than yours.
//
// A choice, so a surface: the sheet the site's other two-button offers are
// (the place, the tilt — systems/ambient/components/permission-sheet.tsx), a
// form sheet on a phone and a small window on anything wider. It used to be a
// card in the bottom toast stack, where it sat on the command bar until
// answered and over any sheet already open; as a surface it takes its turn in
// the stack like everything else that rises from the bottom.
//
// Doing nothing is an answer: the close, the scrim or a swipe keeps the page
// in the language it was shared in, which is where the reader already is.
// ---------------------------------------------------------------------------

/** A language named in the words of `text` — "Chinese" in English, 英文 in Chinese. */
export function languageName(text: Locale, lang: Locale) {
  return t(text, lang === "en" ? "languageNameEn" : "languageNameZh");
}

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function LanguageSharedSheet({
  open,
  shared,
  preferred,
  onChoose,
}: {
  open: boolean;
  /** The language the link was shared in — the page as it stands. */
  shared: Locale;
  /** The reader's own; the sheet speaks it. */
  preferred: Locale;
  onChoose: (lang: Locale) => void;
}) {
  const fill = (text: string) =>
    text
      .replaceAll("{shared}", languageName(preferred, shared))
      .replaceAll("{preferred}", languageName(preferred, preferred));
  const stay = fill(t(preferred, "languageStayIn"));

  return (
    <AdaptiveSurface
      id="surface-language"
      open={open}
      onOpenChange={(next) => {
        if (!next) onChoose(shared);
      }}
      presentation={{ base: "sheet", sm: "window" }}
      windowWidth="380px"
      title={fill(t(preferred, "languageSharedTitle"))}
      closeLabel={stay}
      fitContent
    >
      <div className="space-y-4 pb-2">
        <div aria-hidden="true" className="flex justify-center pt-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Languages className="h-6 w-6 text-foreground" />
          </span>
        </div>
        <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
          {fill(t(preferred, "languageSharedBody"))}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onChoose(preferred)}
            className={cn(BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
          >
            {fill(t(preferred, "languageSwitchTo"))}
          </button>
          <button
            type="button"
            onClick={() => onChoose(shared)}
            className={cn(BUTTON, "bg-foreground/[0.06] hover:bg-foreground/10")}
          >
            {stay}
          </button>
        </div>
      </div>
    </AdaptiveSurface>
  );
}
