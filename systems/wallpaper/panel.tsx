"use client";

import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Check,
  CloudSun,
  ImageIcon,
  Moon,
  Sun,
  X,
} from "lucide-react";
import { useLocale } from "@/services";
import { useWallpaper, useWeather } from "@/systems/ambient";
import { cn } from "@/lib/utils";
import {
  WALLPAPERS,
  wallpaperImage,
  type WallpaperAppearance,
  type WallpaperId,
  type WallpaperSource,
  type WallpaperSettings,
} from "./catalog";

const control =
  "min-h-11 rounded-lg px-3 text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function WallpaperPanel({
  onBack,
  onClose,
}: {
  onBack: () => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { effective, resolved, update, isDebugging } = useWallpaper();
  const { gradientMode, setGradientMode } = useWeather();
  const updateImage = (partial: Partial<WallpaperSettings>) =>
    update({ ...effective, ...partial, source: "image" });
  const panelRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const sources: {
    value: WallpaperSource;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "weather",
      label: zh ? "天气" : "Weather",
      icon: <CloudSun className="size-4" />,
    },
    {
      value: "image",
      label: zh ? "图片" : "Image",
      icon: <ImageIcon className="size-4" />,
    },
    {
      value: "none",
      label: zh ? "纯色" : "Plain",
      icon: <span className="size-3.5 rounded-full border border-current" />,
    },
  ];
  const appearances: { value: WallpaperAppearance; label: string }[] = [
    { value: "auto", label: zh ? "自动" : "Auto" },
    { value: "light", label: zh ? "浅色" : "Light" },
    { value: "dark", label: zh ? "深色" : "Dark" },
  ];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallpaper-title"
      className="relative mx-4 flex max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-overlay backdrop-blur-xl sm:max-h-[84dvh]"
      onKeyDown={(event) => {
        // Keep keyboard navigation inside this secondary window. Escape is
        // owned by CommandProvider and returns to the palette.
        if (event.key !== "Tab") return;
        const controls = panelRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), select, a[href], input",
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        <button
          ref={backRef}
          onClick={onBack}
          className={control}
          aria-label={zh ? "返回命令" : "Back to commands"}
        >
          <ArrowLeft className="size-4" />
        </button>
        <h2 id="wallpaper-title" className="flex-1 text-sm font-medium">
          {zh ? "壁纸" : "Wallpaper"}
        </h2>
        <button
          onClick={onClose}
          className={control}
          aria-label={zh ? "关闭壁纸设置" : "Close wallpaper settings"}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div
          className="flex gap-1 rounded-xl bg-muted/50 p-1"
          role="group"
          aria-label={zh ? "背景类型" : "Background type"}
        >
          {sources.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => update({ source: value })}
              aria-pressed={effective.source === value}
              className={cn(
                control,
                "flex flex-1 items-center justify-center gap-2",
                effective.source === value && "bg-background shadow-sm",
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        {effective.source === "image" ? (
          <div className="mt-5 space-y-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {zh ? "壁纸外观" : "Wallpaper appearance"}
                </span>
                <div
                  className="flex gap-1 rounded-lg bg-muted/50 p-1"
                  role="group"
                  aria-label={zh ? "壁纸外观" : "Wallpaper appearance"}
                >
                  {appearances.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => updateImage({ appearance: value })}
                      aria-pressed={effective.appearance === value}
                      className={cn(
                        control,
                        "min-h-10",
                        effective.appearance === value &&
                          "bg-background shadow-sm",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {zh
                  ? "自动跟随网站的浅色或深色外观。点击下方缩略图选用一对壁纸。"
                  : "Auto follows the site’s light or dark appearance. Choose a pair below."}
              </p>
            </div>
            <div
              className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4"
              role="group"
              aria-label={zh ? "Apple 内置壁纸" : "Built-in Apple wallpapers"}
            >
              {WALLPAPERS.map((wallpaper) => {
                const selected =
                  effective.light === wallpaper.id &&
                  effective.dark === wallpaper.id;
                return (
                  <button
                    key={wallpaper.id}
                    onClick={() =>
                      updateImage({ light: wallpaper.id, dark: wallpaper.id })
                    }
                    aria-pressed={selected}
                    className="group min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-popover"
                    aria-label={`${wallpaper.name} — ${zh ? "明暗配对" : "light and dark pair"}`}
                  >
                    <span
                      className={cn(
                        "relative flex aspect-[16/10] overflow-hidden rounded-xl border-2 transition-colors",
                        selected
                          ? "border-foreground"
                          : "border-transparent group-hover:border-foreground/30",
                      )}
                    >
                      {(["light", "dark"] as const).map((variant) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={variant}
                          src={wallpaperImage(wallpaper.id, variant, true)}
                          alt=""
                          width={240}
                          height={150}
                          loading="lazy"
                          className="h-full w-1/2 object-cover"
                        />
                      ))}
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/40 p-1 text-white">
                        <Sun className="size-3" />
                      </span>
                      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/40 p-1 text-white">
                        <Moon className="size-3" />
                      </span>
                      {selected && (
                        <span className="absolute right-2 top-2 rounded-full bg-foreground p-1 text-background">
                          <Check className="size-3" />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 px-0.5">
                      <span className="text-sm font-medium">
                        {wallpaper.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {wallpaper.platform} · {wallpaper.year}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <fieldset className="border-t border-border/60 pt-4">
              <legend className="px-1 text-xs text-muted-foreground">
                {zh ? "或分别选择" : "Or choose each appearance"}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(["light", "dark"] as const).map((variant) => (
                  <label
                    key={variant}
                    className="min-w-0 space-y-1.5 text-xs text-muted-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      {variant === "light" ? (
                        <Sun className="size-3.5" />
                      ) : (
                        <Moon className="size-3.5" />
                      )}
                      {variant === "light"
                        ? zh
                          ? "浅色壁纸"
                          : "Light wallpaper"
                        : zh
                          ? "深色壁纸"
                          : "Dark wallpaper"}
                    </span>
                    <select
                      value={effective[variant]}
                      onChange={(e) =>
                        updateImage({
                          [variant]: e.target.value as WallpaperId,
                        })
                      }
                      className="min-h-11 w-full rounded-lg border border-border bg-background px-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                    >
                      {WALLPAPERS.map((wallpaper) => (
                        <option key={wallpaper.id} value={wallpaper.id}>
                          {wallpaper.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[11px] text-muted-foreground">
              {zh
                ? "原始壁纸由 Apple 设计，已内置于本站。"
                : "Original wallpapers by Apple. Included locally with this site."}
            </p>
          </div>
        ) : effective.source === "weather" ? (
          <div className="space-y-4 py-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {zh
                ? "让天气与日出日落为背景着色。"
                : "Let the weather, sunrise and sunset color your surroundings."}
            </p>
            <div
              className="flex gap-2"
              role="group"
              aria-label={zh ? "天气显示范围" : "Weather placement"}
            >
              {(["full", "widget"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={gradientMode === mode}
                  onClick={() => {
                    update({ source: "weather" });
                    setGradientMode(mode);
                  }}
                  className={cn(
                    control,
                    "flex-1 border border-border",
                    gradientMode === mode && "bg-accent/60",
                  )}
                >
                  {mode === "full"
                    ? zh
                      ? "全屏"
                      : "Full screen"
                    : zh
                      ? "仅卡片"
                      : "Widgets only"}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="py-6 text-sm leading-relaxed text-muted-foreground">
            {zh
              ? "使用网站的纯色背景，专注于阅读。"
              : "A quiet, plain background for reading."}
          </p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {zh
            ? "日出日落提醒在所有壁纸模式下均可使用。"
            : "Sunrise and sunset notifications remain available with every wallpaper."}
        </p>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-2">
        <span role="status" className="text-xs text-muted-foreground">
          {isDebugging
            ? zh
              ? "调试预览中"
              : "Devtool preview active"
            : effective.source === "image"
              ? `${WALLPAPERS.find((w) => w.id === resolved.id)?.name} · ${resolved.variant === "light" ? (zh ? "浅色" : "Light") : zh ? "深色" : "Dark"}`
              : zh
                ? "已自动保存"
                : "Saved automatically"}
        </span>
        <button
          onClick={onClose}
          className={cn(
            control,
            "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          {zh ? "完成" : "Done"}
        </button>
      </footer>
    </div>
  );
}
