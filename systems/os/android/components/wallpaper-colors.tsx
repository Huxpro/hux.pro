"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { getSchemeStyleLabel, useOptionalOsTheme, type SeedChoice } from "@/services/os-theme";
import { Check } from "lucide-react";
import { SCHEME_STYLES, type SchemeStyle } from "../lib/scheme";
import { BASIC_SEEDS, swatchColors, wallpaperOptions } from "../lib/wallpaper-colors";
import { useWallpaperSeeds } from "./use-wallpaper-seeds";

// =============================================================================
// WallpaperColors — the "Colors" half of Android's Wallpaper & style.
//
// Two rows of swatches: the wallpaper's four options (its seeds, best
// first, shared out with styles the way Android fills the slots;
// lib/wallpaper-colors.ts) and the basic colours that ignore it. Each swatch
// is Android's — a disc, its top half the primary accent, its bottom
// quarters secondary and tertiary — drawn in its style, so what a swatch
// shows is what the widgets will wear. The selected one
// shrinks inside a ring, on the Expressive fast spatial spring.
//
// Then the style, as M3 filter chips: tonal spot (Android's default),
// neutral, vibrant, expressive, monochrome.
//
// Android theme only: the wallpaper sheet mounts it in a `<Themed android>` slot.
// =============================================================================

function Swatch({
  seed,
  style,
  selected,
  label,
  onSelect,
}: {
  seed: number;
  /** The style the swatch is drawn in: its own, or the one in force. */
  style: SchemeStyle;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const { primary, secondary, tertiary } = swatchColors(seed, style);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "relative flex size-14 shrink-0 items-center justify-center rounded-full",
        "outline-offset-2 transition-[box-shadow] duration-(--md-spring-fast-effects-duration)",
        selected && "shadow-[inset_0_0_0_2px_var(--md-on-surface)]",
      )}
    >
      <svg
        aria-hidden
        viewBox="-1 -1 2 2"
        className={cn(
          "size-12 transition-transform duration-(--md-spring-fast-spatial-duration) ease-(--md-spring-fast-spatial)",
          selected && "scale-[0.8]",
        )}
      >
        <path d="M-1 0A1 1 0 0 1 1 0Z" fill={primary} />
        <path d="M0 0L-1 0A1 1 0 0 0 0 1Z" fill={secondary} />
        <path d="M0 0L0 1A1 1 0 0 0 1 0Z" fill={tertiary} />
      </svg>
    </button>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div data-section-label="" className="px-0.5 text-[11px] font-mono text-muted-foreground">
        {label}
      </div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {children}
      </div>
    </div>
  );
}

export function WallpaperColors({ className }: { className?: string }) {
  const { locale } = useLocale();
  const os = useOptionalOsTheme();
  const options = wallpaperOptions(useWallpaperSeeds());
  if (!os) return null;
  const { seed: choice, setSeed, schemeStyle, setSchemeStyle } = os;
  const optionLabel = (i: number) => `${t(locale, "mdColorOption")} ${i + 1}`;
  const is = (c: SeedChoice) =>
    c.kind === choice.kind &&
    (c.kind === "basic"
      ? choice.kind === "basic" && choice.argb === c.argb
      : choice.kind === "wallpaper" &&
        Math.min(choice.index, options.length - 1) === c.index &&
        options[c.index].style === schemeStyle);

  return (
    <div className={cn("space-y-4", className)}>
      <Row label={t(locale, "mdWallpaperColors")}>
        {options.map((option, index) => (
          <Swatch
            key={`w${index}-${option.seed}`}
            seed={option.seed}
            style={option.style}
            label={optionLabel(index)}
            selected={is({ kind: "wallpaper", index })}
            onSelect={() => {
              // An option is a seed *and* a style, as on Android.
              setSeed({ kind: "wallpaper", index });
              setSchemeStyle(option.style);
            }}
          />
        ))}
      </Row>
      <Row label={t(locale, "mdBasicColors")}>
        {BASIC_SEEDS.map((argb, i) => (
          <Swatch
            key={`b${argb}`}
            seed={argb}
            style={schemeStyle}
            label={`${t(locale, "mdBasicColors")} ${i + 1}`}
            selected={is({ kind: "basic", argb })}
            onSelect={() => setSeed({ kind: "basic", argb })}
          />
        ))}
      </Row>
      <div className="space-y-2">
        <div data-section-label="" className="px-0.5 text-[11px] font-mono text-muted-foreground">
          {t(locale, "mdColorStyle")}
        </div>
        <div role="radiogroup" aria-label={t(locale, "mdColorStyle")} className="flex flex-wrap gap-2">
          {SCHEME_STYLES.map((style) => {
            const on = style === schemeStyle;
            return (
              // M3 filter chip: 32dp, 8dp corners, an `outline-variant` edge;
              // selected, tonal with a leading check.
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSchemeStyle(style)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-[8px] px-4 text-sm font-medium tracking-[0.1px]",
                  "transition-[background-color,color,padding] duration-(--md-spring-fast-effects-duration)",
                  on
                    ? "bg-(--md-secondary-container) pl-2 text-(--md-on-secondary-container)"
                    : "text-(--md-on-surface-variant) shadow-[inset_0_0_0_1px_var(--md-outline-variant)] hover:bg-[color-mix(in_srgb,var(--md-on-surface-variant)_8%,transparent)]",
                )}
              >
                {on && <Check aria-hidden className="size-[18px]" />}
                {getSchemeStyleLabel(style, locale)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
