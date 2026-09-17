"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useOptionalWindows } from "@/systems/windows";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// LoadBundlePanel — inviting OTA Lynx open form inside ⌘K chrome
//
// One field (the bundle URL), one action (Open), one way out (← / Esc).
// Title is derived from the path; flavour belongs to the bundle.
//
// Two chromes. In the desktop popover the panel replaces the palette's body in
// place, so it brings its own header: a back arrow and the title. On a phone it
// is the body of a sheet stacked on the palette, and that sheet's header is
// already the icon, the title and one way out — so the panel drops both and
// keeps only the hint, which reads as the field's subtitle.
// =============================================================================

function isPlausibleBundleUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return v.startsWith("/");
  }
}

export function LoadBundlePanel({
  onBack,
  onLoaded,
  chrome = "panel",
}: {
  onBack: () => void;
  onLoaded: () => void;
  /** "panel": the panel carries its own back arrow and title (the popover).
   *  "sheet": the surrounding sheet header carries them already. */
  chrome?: "panel" | "sheet";
}) {
  const { locale } = useLocale();
  const windows = useOptionalWindows();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const valid = isPlausibleBundleUrl(url);
  const showError = touched && url.trim().length > 0 && !valid;

  const submit = () => {
    setTouched(true);
    const trimmed = url.trim();
    if (!windows || !isPlausibleBundleUrl(trimmed)) return;
    windows.openBundleUrl(trimmed);
    onLoaded();
  };

  return (
    <div className="px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
      {chrome === "panel" ? (
        <div className="mb-4 flex items-start gap-2">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              "text-muted-foreground transition-colors",
              "hover:bg-accent/40 hover:text-foreground",
            )}
            aria-label={t(locale, "backToSearch")}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 pt-1">
            <div className="text-sm font-medium text-foreground">
              {t(locale, "appsLoadBundleTitle")}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {t(locale, "appsLoadBundleHint")}
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-3 px-1 text-[12px] leading-snug text-muted-foreground">
          {t(locale, "appsLoadBundleHint")}
        </p>
      )}

      {/* Invite: one paste field + Open, same glass inset language as ⌘K */}
      <div
        className={cn(
          "flex items-stretch gap-2 rounded-2xl border bg-muted/30 p-1.5 pl-3",
          "transition-colors focus-within:border-border focus-within:bg-muted/45",
          "focus-within:ring-1 focus-within:ring-ring/40",
          showError ? "border-destructive/50" : "border-border/60",
        )}
      >
        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }
          }}
          placeholder={t(locale, "appsLoadBundlePlaceholder")}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={showError}
          className={cn(
            "min-w-0 flex-1 bg-transparent py-2",
            "font-mono text-[13px] text-foreground",
            "placeholder:font-sans placeholder:text-tertiary-foreground",
            "outline-none",
          )}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className={cn(
            "shrink-0 rounded-xl px-3.5 text-sm font-medium",
            "bg-foreground text-background",
            "transition-opacity",
            "disabled:cursor-not-allowed disabled:opacity-30",
            "hover:opacity-90 active:opacity-80",
          )}
        >
          {t(locale, "appsLoadBundleOpen")}
        </button>
      </div>

      {showError && (
        <p className="mt-2 px-1 text-[11px] text-destructive/90">
          {t(locale, "appsLoadBundleInvalid")}
        </p>
      )}
    </div>
  );
}
