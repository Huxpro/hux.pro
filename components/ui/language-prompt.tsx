"use client";

import { dismissToast, showCustomToast } from "@/components/ui/system-sonner";
import { localeNames, useLocale, type Locale } from "@/services";
import { Languages } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// =============================================================================
// LanguagePrompt — the first visit asks which language.
//
// The site speaks English and Chinese, and on a first visit it can only guess
// which from the browser (services/locale.tsx). A guess is often right and
// sometimes not: a Chinese reader on an English system, an English reader
// borrowing a phone. So the first visit asks, once, from the bottom — the
// same toast the language-conflict notice uses on a shared post
// (components/post/language-toast.tsx), the question put in both languages
// since the site does not yet know which one is being read, the guess as the
// primary answer.
//
// Once: the question is marked asked when it is shown, whatever the answer
// (or none). The About's own corner switch, the command palette and a post's
// header are there for every visit after.
//
// Not where something else already speaks to language: a post, whose own
// notice handles a shared link in the other language, and the tools (the
// editors, vitre), which are not visited to be read.
// =============================================================================

const ASKED_KEY = "hux_locale_asked";
const TOAST_ID = "language-prompt";
/** After the About has risen (700ms, systems/about) and settled. */
const DELAY_MS = 1800;
const QUIET = [/^\/writing\/[^/]+\/(en|zh)\/?$/, /^\/editor/, /^\/vitre/];

const QUESTION: Record<Locale, string> = {
  en: "What language do you prefer?",
  zh: "你更习惯哪种语言？",
};

function readAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

function writeAsked() {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    /* storage blocked: it will ask again, which is the lesser fault */
  }
}

function LanguagePromptToast({
  guess,
  onChoose,
}: {
  guess: Locale;
  onChoose: (locale: Locale) => void;
}) {
  const other: Locale = guess === "en" ? "zh" : "en";
  return (
    <div
      role="dialog"
      aria-label={`${QUESTION[guess]} ${QUESTION[other]}`}
      className="w-full max-w-sm bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-overlay animate-in slide-in-from-bottom-4 fade-in duration-200"
    >
      <div className="px-4 pt-4 pb-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
            <Languages className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            Language · 语言
          </span>
        </div>
        {/* Both, the guess first: the site cannot know yet which is read. */}
        <p className="text-sm text-foreground" lang={guess}>
          {QUESTION[guess]}
        </p>
        <p className="text-sm text-muted-foreground" lang={other}>
          {QUESTION[other]}
        </p>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={() => onChoose(guess)}
          lang={guess}
          className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {localeNames[guess]}
        </button>
        <button
          type="button"
          onClick={() => onChoose(other)}
          lang={other}
          className="flex-1 px-4 py-2.5 text-muted-foreground rounded-lg font-medium text-sm whitespace-nowrap transition-all hover:bg-muted/50 active:scale-[0.98] border border-border/50"
        >
          {localeNames[other]}
        </button>
      </div>
    </div>
  );
}

export function LanguagePrompt() {
  const { locale, setLocale, hydrated, guessed } = useLocale();
  const pathname = usePathname();
  // Decided once, on the first page the visitor lands on.
  const decided = useRef(false);

  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    if (!guessed || readAsked()) return;
    if (QUIET.some((re) => re.test(pathname))) return;
    const guess = locale;
    const id = window.setTimeout(() => {
      writeAsked();
      showCustomToast(
        <LanguagePromptToast
          guess={guess}
          onChoose={(choice) => {
            dismissToast(TOAST_ID);
            // The guess, confirmed, is a choice too: stored as one.
            setLocale(choice);
          }}
        />,
        { id: TOAST_ID },
      );
    }, DELAY_MS);
    return () => window.clearTimeout(id);
  }, [hydrated, guessed, locale, pathname, setLocale]);

  return null;
}
