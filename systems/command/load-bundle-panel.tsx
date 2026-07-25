"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useOptionalWindows } from "@/systems/windows";
import type { AppFlavor } from "@/lib/app-icon-core";
import { Link2, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// LoadBundlePanel — System UI form for OTA Lynx bundles
//
// Lives inside the command-palette chrome (same glass surface as search /
// slash). Replaces window.prompt with a mono URL field + flavour chips that
// match the runtime badge language on app tiles.
// =============================================================================

function isPlausibleBundleUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    // Allow site-local paths (/…/main.web.bundle) for built-in bundles.
    return v.startsWith("/");
  }
}

export function LoadBundlePanel({
  onBack,
  onLoaded,
}: {
  onBack: () => void;
  onLoaded: () => void;
}) {
  const { locale } = useLocale();
  const windows = useOptionalWindows();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [flavor, setFlavor] = useState<AppFlavor>("react");
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
    windows.openBundleUrl(trimmed, { flavor });
    onLoaded();
  };

  return (
    <div className="p-3 sm:p-4">
      {/* Header — back + title, mirrors slash-mode chrome density */}
      <div className="mb-3 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors",
            "hover:bg-accent/40 hover:text-foreground",
          )}
          aria-label={t(locale, "backToSearch")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {t(locale, "appsLoadBundleTitle")}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {t(locale, "appsLoadBundleHint")}
          </div>
        </div>
      </div>

      {/* URL field — mono, glass inset */}
      <label className="block px-1">
        <span className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          URL
        </span>
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
          placeholder="https://…/main.web.bundle"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            "w-full rounded-xl border bg-muted/30 px-3 py-2.5",
            "font-mono text-[13px] text-foreground",
            "placeholder:text-muted-foreground/50",
            "outline-none transition-colors",
            "focus:border-border focus:bg-muted/45 focus:ring-1 focus:ring-ring/40",
            showError
              ? "border-destructive/50"
              : "border-border/60",
          )}
        />
        {showError && (
          <span className="mt-1.5 block text-[11px] text-destructive/90">
            {t(locale, "appsLoadBundleInvalid")}
          </span>
        )}
      </label>

      {/* Flavour — same React-blue / Vue-green language as AppBadge */}
      <div className="mt-4 px-1">
        <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t(locale, "appsLoadBundleFlavor")}
        </div>
        <div
          className={cn(
            "inline-flex rounded-xl border border-border/50 bg-muted/25 p-0.5",
          )}
          role="group"
          aria-label={t(locale, "appsLoadBundleFlavor")}
        >
          <FlavorChip
            active={flavor === "react"}
            onClick={() => setFlavor("react")}
            activeClass="bg-[#149eca] text-white"
            label="React"
          />
          <FlavorChip
            active={flavor === "vue"}
            onClick={() => setFlavor("vue")}
            activeClass="bg-[#42b883] text-white"
            label="Vue"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] text-muted-foreground">
          <kbd className="mr-1 rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>
          {t(locale, "select")}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              "rounded-xl px-3 py-2 text-sm text-muted-foreground",
              "transition-colors hover:bg-accent/30 hover:text-foreground",
            )}
          >
            {t(locale, "appsLoadBundleCancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium",
              "border border-border/60 bg-foreground text-background",
              "transition-opacity",
              "disabled:cursor-not-allowed disabled:opacity-35",
              "hover:opacity-90 active:opacity-80",
            )}
          >
            {t(locale, "appsLoadBundleOpen")}
          </button>
        </div>
      </div>
    </div>
  );
}

function FlavorChip({
  active,
  onClick,
  activeClass,
  label,
}: {
  active: boolean;
  onClick: () => void;
  activeClass: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? activeClass
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
