"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ICON_CONFIG,
  TEXT_PRESETS,
  type IconBackground,
  type IconConfig,
} from "@/lib/icon/config";
import { buildIconSvg } from "@/lib/icon/render";
import {
  ColorField,
  Field,
  Section,
  Segmented,
  Slider,
  TextField,
  Toggle,
} from "./controls";

/**
 * Inlines the icon SVG into the DOM (not via `<img>`) so the wordmark renders
 * with the page's loaded font families — WYSIWYG against the committed asset,
 * which embeds the same glyphs. One base render is CSS-scaled to each slot, so
 * textures stay proportional; `idPrefix` keeps the internal defs from
 * cross-wiring between the multiple inlined copies.
 */
function IconPreview({
  config,
  idPrefix,
  className,
  style,
}: {
  config: IconConfig;
  idPrefix: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const html = useMemo(
    () => buildIconSvg(config, { size: 512, idPrefix }),
    [config, idPrefix],
  );
  return (
    <div
      className={cn(
        "overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full",
        className,
      )}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface IconEditorViewProps {
  initialConfig: IconConfig;
}

export function IconEditorView({ initialConfig }: IconEditorViewProps) {
  const [config, setConfig] = useState<IconConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<IconConfig>(initialConfig);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(savedConfig),
    [config, savedConfig],
  );

  const set = useCallback(
    <K extends keyof IconConfig>(key: K, value: IconConfig[K]) =>
      setConfig((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setBg = useCallback(
    <K extends keyof IconBackground>(key: K, value: IconBackground[K]) =>
      setConfig((prev) => ({
        ...prev,
        background: { ...prev.background, [key]: value },
      })),
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSavedConfig(config);
      toast.success(
        json.fontEmbedded
          ? "Saved · icons regenerated (font embedded)"
          : "Saved · icons regenerated (font fallback — offline?)",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_ICON_CONFIG);
    toast.message("Reset to default config (not yet saved)");
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([buildIconSvg(config, { size: 512 })], {
      type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "icon.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, [config]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-muted/5 px-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium tracking-wide">
            icon.json
          </span>
          {isDirty && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-500">
              unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <Download className="h-3 w-3" />
            SVG
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-1.5 rounded bg-foreground px-3 py-1.5 font-mono text-xs text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Preview canvas — SVG is inlined (not <img>) so it renders with the
            page's loaded font families, making the preview WYSIWYG. */}
        <div className="flex flex-1 flex-col items-center justify-center gap-10 overflow-y-auto bg-muted/10 p-8">
          {/* Hero preview */}
          <div className="flex flex-col items-center gap-4">
            <IconPreview
              config={config}
              idPrefix="hero"
              className="h-64 w-64 rounded-[22%] shadow-2xl ring-1 ring-border/40"
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              app tile · 256
            </span>
          </div>

          {/* Size ladder — legibility check at favicon sizes */}
          <div className="flex items-end gap-6">
            {[128, 64, 32, 16].map((px) => (
              <div key={px} className="flex flex-col items-center gap-2">
                <IconPreview
                  config={config}
                  idPrefix={`s${px}`}
                  className="rounded-[22%] ring-1 ring-border/40"
                  style={{ width: px, height: px }}
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {px}
                </span>
              </div>
            ))}
          </div>

          {/* Round mask + full-bleed square */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <IconPreview
                config={config}
                idPrefix="round"
                className="h-20 w-20 rounded-full ring-1 ring-border/40"
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                round
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <IconPreview
                config={config}
                idPrefix="square"
                className="h-20 w-20 ring-1 ring-border/40"
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                square
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border">
          <Section title="Typography">
            <Field label="Wordmark">
              <TextField
                value={config.text}
                onChange={(v) => set("text", v)}
                placeholder="hux"
              />
            </Field>
            <div className="flex flex-wrap gap-1">
              {TEXT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => set("text", preset)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-xs transition-colors",
                    config.text === preset
                      ? "border-foreground/30 bg-foreground text-background"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <Field label="Typeface">
              <Segmented
                value={config.fontFamily}
                onChange={(v) => set("fontFamily", v)}
                options={[
                  { value: "sans", label: "Sans" },
                  { value: "serif", label: "Serif" },
                  { value: "mono", label: "Mono" },
                ]}
              />
            </Field>

            <Field label="Case">
              <Segmented
                value={config.textTransform}
                onChange={(v) => set("textTransform", v)}
                options={[
                  { value: "lower", label: "aa" },
                  { value: "none", label: "Aa" },
                  { value: "upper", label: "AA" },
                ]}
              />
            </Field>

            <Field label="Weight" hint={String(config.fontWeight)}>
              <Slider
                value={config.fontWeight}
                min={100}
                max={900}
                step={100}
                onChange={(v) => set("fontWeight", v)}
              />
            </Field>

            <Field label="Size" hint={config.fontSize.toFixed(2)}>
              <Slider
                value={config.fontSize}
                min={0.1}
                max={0.95}
                step={0.01}
                onChange={(v) => set("fontSize", v)}
              />
            </Field>

            <Field label="Tracking" hint={config.letterSpacing.toFixed(3)}>
              <Slider
                value={config.letterSpacing}
                min={-0.2}
                max={0.5}
                step={0.005}
                onChange={(v) => set("letterSpacing", v)}
              />
            </Field>

            <Field label="Nudge Y" hint={config.offsetY.toFixed(2)}>
              <Slider
                value={config.offsetY}
                min={-0.3}
                max={0.3}
                step={0.01}
                onChange={(v) => set("offsetY", v)}
              />
            </Field>

            <Field label="Nudge X" hint={config.offsetX.toFixed(2)}>
              <Slider
                value={config.offsetX}
                min={-0.3}
                max={0.3}
                step={0.01}
                onChange={(v) => set("offsetX", v)}
              />
            </Field>

            <Toggle
              label="Italic"
              value={config.italic}
              onChange={(v) => set("italic", v)}
            />

            <Field label="Wordmark color">
              <ColorField
                value={config.textColor}
                onChange={(v) => set("textColor", v)}
              />
            </Field>
          </Section>

          <Section title="Background">
            <Field label="Texture">
              <Segmented
                value={config.background.style}
                onChange={(v) => setBg("style", v)}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dots", label: "Dots" },
                  { value: "grid", label: "Grid" },
                  { value: "lines", label: "Lines" },
                  { value: "noise", label: "Noise" },
                  { value: "gradient", label: "Grad" },
                ]}
              />
            </Field>

            <Field label="Base color">
              <ColorField
                value={config.background.color}
                onChange={(v) => setBg("color", v)}
              />
            </Field>

            {config.background.style === "gradient" ? (
              <Field label="Gradient end">
                <ColorField
                  value={config.background.gradientColor}
                  onChange={(v) => setBg("gradientColor", v)}
                />
              </Field>
            ) : (
              config.background.style !== "solid" && (
                <>
                  <Field label="Texture color">
                    <ColorField
                      value={config.background.textureColor}
                      onChange={(v) => setBg("textureColor", v)}
                    />
                  </Field>
                  <Field
                    label="Texture opacity"
                    hint={config.background.textureOpacity.toFixed(2)}
                  >
                    <Slider
                      value={config.background.textureOpacity}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setBg("textureOpacity", v)}
                    />
                  </Field>
                  <Field
                    label="Density"
                    hint={config.background.scale.toFixed(2)}
                  >
                    <Slider
                      value={config.background.scale}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setBg("scale", v)}
                    />
                  </Field>
                </>
              )
            )}

            {(config.background.style === "lines" ||
              config.background.style === "gradient") && (
              <Field label="Angle" hint={`${Math.round(config.background.angle)}°`}>
                <Slider
                  value={config.background.angle}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setBg("angle", v)}
                />
              </Field>
            )}
          </Section>

          <Section title="Shape">
            <Field
              label="Corner radius"
              hint={config.cornerRadius.toFixed(2)}
            >
              <Slider
                value={config.cornerRadius}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => set("cornerRadius", v)}
              />
            </Field>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground/70">
              Baked into the SVG. Leave at 0 for full-bleed — most OSes apply
              their own mask (previewed above).
            </p>
          </Section>
        </aside>
      </div>
    </div>
  );
}
