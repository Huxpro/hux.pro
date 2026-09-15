"use client";

import { localeNames, type Locale } from "@/services";
import { Languages } from "lucide-react";

interface LanguageConflictToastProps {
  sharedLang: Locale;
  systemLang: Locale;
  onChoose: (lang: Locale) => void;
}

/**
 * Toast shown when a shared link has a different language than the user's preference.
 * Non-blocking alternative to the modal dialog.
 */
export function LanguageConflictToast({
  sharedLang,
  systemLang,
  onChoose,
}: LanguageConflictToastProps) {
  return (
    <div className="w-full max-w-md bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-overlay animate-in slide-in-from-bottom-4 fade-in duration-200">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/10">
            <Languages className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {systemLang === "en" ? "Language mismatch" : "语言不匹配"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {systemLang === "en" ? (
            <>
              Shared in{" "}
              <span className="font-medium text-foreground">
                {localeNames[sharedLang]}
              </span>
              , you prefer{" "}
              <span className="font-medium text-foreground">
                {localeNames[systemLang]}
              </span>
            </>
          ) : (
            <>
              分享语言{" "}
              <span className="font-medium text-foreground">
                {localeNames[sharedLang]}
              </span>
              ，您偏好{" "}
              <span className="font-medium text-foreground">
                {localeNames[systemLang]}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Actions - Primary: user preference, Secondary: shared language */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={() => onChoose(systemLang)}
          className="flex-1 px-4 py-2.5 bg-foreground text-background rounded-lg font-medium text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {systemLang === "en" ? "Keep English" : "保持中文"}
        </button>
        <button
          onClick={() => onChoose(sharedLang)}
          className="flex-1 px-4 py-2.5 text-muted-foreground rounded-lg font-medium text-sm whitespace-nowrap transition-all hover:bg-muted/50 active:scale-[0.98] border border-border/50"
        >
          {systemLang === "en"
            ? `Read in ${localeNames[sharedLang]}`
            : `阅读 ${localeNames[sharedLang]} 版`}
        </button>
      </div>
    </div>
  );
}

interface LanguageSwitchToastProps {
  currentLang: Locale;
  systemLang: Locale;
}

/**
 * Toast shown after explicitly switching language.
 * Informs user this is ephemeral and doesn't change their preference.
 */
export function LanguageSwitchToast({
  currentLang,
  systemLang,
}: LanguageSwitchToastProps) {
  const isSystemLang = currentLang === systemLang;

  return (
    <div className="inline-flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur-xl border border-border/50 rounded-full shadow-raised animate-in slide-in-from-bottom-2 fade-in duration-200">
      <Languages className="w-4 h-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {systemLang === "en" ? (
          <>
            Viewing in{" "}
            <span className="font-medium text-foreground">
              {localeNames[currentLang]}
            </span>
            {!isSystemLang && (
              <span className="text-tertiary-foreground">
                {" "}
                · Preference unchanged
              </span>
            )}
          </>
        ) : (
          <>
            正在阅读{" "}
            <span className="font-medium text-foreground">
              {localeNames[currentLang]}
            </span>
            {!isSystemLang && (
              <span className="text-tertiary-foreground"> · 偏好未更改</span>
            )}
          </>
        )}
      </span>
    </div>
  );
}
