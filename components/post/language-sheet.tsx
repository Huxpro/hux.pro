"use client";

import type { Locale } from "@/services";
import { t } from "@/services";
import { cn } from "@/lib/utils";
import { useOptionalAbout } from "@/systems/about";
import { AdaptiveSurface } from "@/systems/surface";
import { Languages } from "lucide-react";

// ---------------------------------------------------------------------------
// LanguageSharedSheet: a link shared in the other language than yours.
//
// A choice, so a surface, but a small one: a bigger toast, not a dialog. It
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

/** A language named in the words of `text`: "Chinese" in English, 英文 in Chinese. */
export function languageName(text: Locale, lang: Locale) {
  return t(text, lang === "en" ? "languageNameEn" : "languageNameZh");
}

/**
 * Tall and full-width under a thumb; on a desk, a compact row at the foot of
 * the card, the way a banner's actions sit. Nothing there needs a whole line.
 */
const BUTTON = cn(
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors",
  "sm:w-auto sm:rounded-full sm:py-2 sm:text-sm",
  "active:scale-[0.99] motion-reduce:active:scale-100",
);

export function LanguageSharedSheet({
  open,
  shared,
  preferred,
  onChoose,
}: {
  open: boolean;
  /** The language the link was shared in: the page as it stands. */
  shared: Locale;
  /** The reader's own, as far as the site knows; the sheet speaks it. */
  preferred: Locale;
  onChoose: (lang: Locale) => void;
}) {
  // Which language says what. The sheet's own words (the title, the body)
  // are chrome, so they speak the reader's language, like the rest of the
  // site's system text. The two choices do not: each is written in the
  // language it leads to, the way an OS lists languages by their own names.
  // "The reader's language" is the site's guess (a stored choice, or the
  // browser's), and a guess can be wrong: an English browser in a Chinese
  // reader's hands. Written in their own languages, each option is legible to
  // exactly the person who wants it, whichever way the guess went.
  const inPreferred = (key: Parameters<typeof t>[1]) =>
    t(preferred, key)
      .replaceAll("{shared}", languageName(preferred, shared))
      .replaceAll("{preferred}", languageName(preferred, preferred));
  const switchLabel = inPreferred("languageSwitchTo");
  const stayLabel = t(shared, "languageStayIn").replaceAll(
    "{shared}",
    languageName(shared, shared),
  );
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
      title={inPreferred("languageSharedTitle")}
      closeLabel={stayLabel}
      fitContent
    >
      <div className="space-y-4 pb-2 sm:space-y-3">
        {/* The picture is for the phone's form sheet, where it gives the
            thumb's half of the screen something to stand on; the banner on a
            desk says it in its title. */}
        <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
            <Languages className="h-6 w-6 text-foreground" />
          </span>
        </div>
        <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground sm:text-sm">
          {inPreferred("languageSharedBody")}
        </p>
        {/* Primary first in the reading order (top under a thumb); on a desk
            it sits at the trailing end, where a confirming action does. */}
        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <button
            type="button"
            lang={preferred}
            onClick={() => onChoose(preferred)}
            className={cn(BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
          >
            {switchLabel}
          </button>
          <button
            type="button"
            lang={shared}
            onClick={() => onChoose(shared)}
            className={cn(BUTTON, "bg-foreground/[0.06] hover:bg-foreground/10")}
          >
            {stayLabel}
          </button>
        </div>
      </div>
    </AdaptiveSurface>
  );
}
