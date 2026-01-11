"use client";

import { localeNames, type Locale } from "@/services";

interface LanguageConflictDialogProps {
  sharedLang: Locale;
  systemLang: Locale;
  onChoose: (lang: Locale) => void;
}

/**
 * Dialog shown when a shared link has a different language than the user's preference.
 * Allows user to choose between the shared language or their system preference.
 */
export function LanguageConflictDialog({
  sharedLang,
  systemLang,
  onChoose,
}: LanguageConflictDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={() => onChoose(systemLang)}
      />

      {/* Dialog */}
      <div className="relative w-full sm:w-auto sm:min-w-[320px] sm:max-w-sm bg-background/95 backdrop-blur-xl border-t sm:border border-border/50 sm:rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 fade-in duration-200">
        {/* Compact header with language indicator */}
        <div className="px-5 pt-5 pb-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs font-mono text-muted-foreground mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
            {systemLang === "en" ? "Language mismatch" : "语言不匹配"}
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

        {/* Action buttons - stacked on mobile for thumb reach */}
        <div className="px-3 pb-3 space-y-1.5">
          <button
            onClick={() => onChoose(sharedLang)}
            className="w-full px-4 py-3 bg-foreground text-background rounded-lg font-medium text-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {sharedLang === "en" ? "Read in English" : "阅读中文版"}
          </button>
          <button
            onClick={() => onChoose(systemLang)}
            className="w-full px-4 py-3 text-muted-foreground rounded-lg font-medium text-sm transition-all hover:bg-muted/50 active:scale-[0.98]"
          >
            {systemLang === "en" ? "Keep English" : "保持中文"}
          </button>
        </div>
      </div>
    </div>
  );
}
