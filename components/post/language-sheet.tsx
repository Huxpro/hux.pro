"use client";

import type { Locale } from "@/services";
import { t } from "@/services";
import { cn } from "@/lib/utils";
import { useOptionalAbout } from "@/systems/about";
import { AdaptiveSurface } from "@/systems/surface";
import { Languages } from "lucide-react";

// ---------------------------------------------------------------------------
// LanguageSharedSheet — a link shared in the other language than yours.
//
// A choice, so a surface — but a small one: a bigger toast, not a dialog. It
// rises from the bottom at every width, a form sheet as tall as what it holds
// and no wider than 400px on a desk, and it is not modal: no scrim, the page
// stays live and scrollable behind it, and it waits there until answered. A
// centred window put it in the middle of the reading, higher than a question
// about the page should sit. It used to be a card in the bottom toast stack,
// where it sat on the command bar until answered and over any sheet already
// open; as a surface it takes its turn in the stack like everything else that
// rises from the bottom.
//
// Doing nothing is an answer: the close, the scrim or a swipe keeps the page
// in the language it was shared in, which is where the reader already is.
//
// It waits for the About veil. A shared link is exactly how a newcomer
// arrives, and the veil is what a newcomer meets first; a sheet opened under
// it shows through the veil's blur as a ghost. So it opens when the veil is
// put away, onto the page it is asking about.
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
  const aboutUp = useOptionalAbout()?.isOpen ?? false;

  return (
    <AdaptiveSurface
      id="surface-language"
      open={open && !aboutUp}
      onOpenChange={(next) => {
        if (!next) onChoose(shared);
      }}
      presentation={{ base: "sheet" }}
      sheetMaxWidth="400px"
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
