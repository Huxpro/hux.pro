import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// =============================================================================
// English and Chinese for the demo and the docs. Every string a reader sees is
// a `Text` with both languages, so a missing translation fails the type check.
// API names (props, exports, attributes) stay as they are in both.
// =============================================================================

export type Lang = "en" | "zh";
export interface Text<T = string> {
  en: T;
  zh: T;
}

export const LANG_KEY = "vitre-lang";

/** `?lang=`, then the saved choice, then the browser's language. */
export function initialLang(): Lang {
  const param = new URLSearchParams(location.search).get("lang");
  if (param === "en" || param === "zh") return param;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // Private mode.
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangContextValue>({ lang: "en", setLang: () => {} });

export function LangProvider({
  children,
  persist = true,
}: {
  children: ReactNode;
  /** The phone inside the docs follows the docs and saves nothing itself. */
  persist?: boolean;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      if (!persist) return;
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // Private mode.
      }
    },
    [persist]
  );
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Pick the reader's language from a `Text`. */
export function useT() {
  const { lang } = useLang();
  return useCallback(<T,>(text: Text<T>): T => text[lang], [lang]);
}

export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`lang-switch ${className ?? ""}`} role="group" aria-label="Language / 语言">
      {(["en", "zh"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} data-on={lang === l || undefined} onClick={() => setLang(l)}>
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}
