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
  type TextureSettings,
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
} from "@/app/lab/controls";
import { useLabStrings } from "@/app/lab/i18n";
import { LabButton, LabSection, LabShell, LabUnsaved } from "@/app/lab/shell";
import { ICON_STRINGS } from "./strings";

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
    // `var(--font-mono)` → the exact JetBrains Mono instance next/font loaded
    // site-wide, so the preview matches the rest of the site (and the embedded
    // JetBrains Mono in the shipped asset) glyph-for-glyph.
    () =>
      buildIconSvg(config, {
        size: 512,
        idPrefix,
        fontFamily: "var(--font-mono)",
      }),
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

interface IconLabViewProps {
  initialConfig: IconConfig;
}

export function IconLabView({ initialConfig }: IconLabViewProps) {
  const [config, setConfig] = useState<IconConfig>(initialConfig);
  const [savedConfig, setSavedConfig] = useState<IconConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const S = useLabStrings(ICON_STRINGS);

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

  // Edit a parameter of the *active* texture only — keeps each texture's tuning
  // independent (switching styles never carries another's values over).
  const setTex = useCallback(
    <K extends keyof TextureSettings>(key: K, value: TextureSettings[K]) =>
      setConfig((prev) => {
        const style = prev.background.style;
        if (style === "solid") return prev;
        return {
          ...prev,
          background: {
            ...prev.background,
            [style]: { ...prev.background[style], [key]: value },
          },
        };
      }),
    [],
  );

  // The active texture's settings (null for the plain solid fill).
  const tex: TextureSettings | null =
    config.background.style === "solid"
      ? null
      : config.background[config.background.style];

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/icon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || S.saveFailed);
      setSavedConfig(config);
      toast.success(
        json.rasterized
          ? S.savedRaster
          : S.savedSvgOnly,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : S.saveFailed);
    } finally {
      setSaving(false);
    }
  }, [config, S]);

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_ICON_CONFIG);
    toast.message(S.resetDone);
  }, [S]);

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

  const actions = (
    <>
      <LabButton onClick={handleDownload}>
        <Download />
        SVG
      </LabButton>
      {/* Writing the icon is a wide-screen job, like the Works Lab's. */}
      <LabButton onClick={handleReset} className="hidden lg:inline-flex">
        <RotateCcw />
        {S.reset}
      </LabButton>
      <LabButton tone="primary" onClick={handleSave} disabled={!isDirty || saving} className="hidden lg:inline-flex">
        <Save />
        {saving ? S.saving : S.save}
      </LabButton>
    </>
  );

  return (
    <LabShell
      lab="icon"
      layout="workbench"
      actions={actions}
      meta={
        <span className="inline-flex items-center gap-2">
          {config.text || "—"} · {S.textures[config.background.style]} · r {config.cornerRadius.toFixed(2)}
          {isDirty && <LabUnsaved />}
        </span>
      }
      panel={
        <>
          <Section title={S.typography}>
            <Field label={S.wordmark}>
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

            <Field label={S.weight} hint={String(config.fontWeight)}>
              <Slider
                value={config.fontWeight}
                min={100}
                max={900}
                step={100}
                onChange={(v) => set("fontWeight", v)}
              />
            </Field>

            <Field label={S.size} hint={config.fontSize.toFixed(2)}>
              <Slider
                value={config.fontSize}
                min={0.1}
                max={0.95}
                step={0.01}
                onChange={(v) => set("fontSize", v)}
              />
            </Field>

            <Field label={S.tracking} hint={config.letterSpacing.toFixed(3)}>
              <Slider
                value={config.letterSpacing}
                min={-0.2}
                max={0.5}
                step={0.005}
                onChange={(v) => set("letterSpacing", v)}
              />
            </Field>

            <Field label={S.nudgeY} hint={config.offsetY.toFixed(2)}>
              <Slider
                value={config.offsetY}
                min={-0.3}
                max={0.3}
                step={0.01}
                onChange={(v) => set("offsetY", v)}
              />
            </Field>

            <Field label={S.nudgeX} hint={config.offsetX.toFixed(2)}>
              <Slider
                value={config.offsetX}
                min={-0.3}
                max={0.3}
                step={0.01}
                onChange={(v) => set("offsetX", v)}
              />
            </Field>

            <Toggle
              label={S.italic}
              value={config.italic}
              onChange={(v) => set("italic", v)}
            />

            <Field label={S.wordmarkColor}>
              <ColorField
                value={config.textColor}
                onChange={(v) => set("textColor", v)}
              />
            </Field>
          </Section>

          <Section title={S.background}>
            <Field label={S.texture}>
              <Segmented
                columns={3}
                value={config.background.style}
                onChange={(v) => setBg("style", v)}
                options={[
                  { value: "solid", label: S.textures.solid },
                  { value: "dots", label: S.textures.dots },
                  { value: "grid", label: S.textures.grid },
                  { value: "lines", label: S.textures.lines },
                  { value: "noise", label: S.textures.noise },
                  { value: "gradient", label: S.textures.gradient },
                ]}
              />
            </Field>

            <Field label={S.baseColor}>
              <ColorField
                value={config.background.color}
                onChange={(v) => setBg("color", v)}
              />
            </Field>

            {/* Per-texture controls — each texture keeps its own values. */}
            {tex && config.background.style === "gradient" && (
              <Field label={S.gradientEnd}>
                <ColorField
                  value={tex.gradientColor}
                  onChange={(v) => setTex("gradientColor", v)}
                />
              </Field>
            )}

            {tex && config.background.style !== "gradient" && (
              <>
                <Field label={S.textureColor}>
                  <ColorField
                    value={tex.textureColor}
                    onChange={(v) => setTex("textureColor", v)}
                  />
                </Field>
                <Field
                  label={S.textureOpacity}
                  hint={tex.textureOpacity.toFixed(2)}
                >
                  <Slider
                    value={tex.textureOpacity}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setTex("textureOpacity", v)}
                  />
                </Field>
                <Field label={S.density} hint={tex.scale.toFixed(2)}>
                  <Slider
                    value={tex.scale}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => setTex("scale", v)}
                  />
                </Field>
            </>
          )}

          {tex &&
            (config.background.style === "lines" ||
              config.background.style === "gradient") && (
              <Field label={S.angle} hint={`${Math.round(tex.angle)}°`}>
                <Slider
                  value={tex.angle}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => setTex("angle", v)}
                />
              </Field>
            )}
        </Section>

        <Section title={S.shape}>
          <Field
            label={S.cornerRadius}
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
          <p className="font-mono text-[10px] leading-relaxed text-tertiary-foreground">
            {S.cornerNote}
          </p>
        </Section>
        </>
      }
    >
      {/* Preview — the SVG is inlined (not <img>) so it renders with the
          page's loaded font families, making the preview WYSIWYG. */}
      <LabSection title={S.appTile}>
        <div className="flex justify-center rounded-2xl bg-muted/40 px-6 py-10 sm:py-14">
          <IconPreview
            config={config}
            idPrefix="hero"
            className="size-48 rounded-[22%] shadow-2xl ring-1 ring-border/40 sm:size-64"
          />
        </div>
      </LabSection>

      {/* Size ladder — legibility check at favicon sizes */}
      <LabSection title={S.sizes} note={S.sizesNote}>
        <div className="flex flex-wrap items-end justify-center gap-6 rounded-2xl bg-muted/40 px-6 py-8">
          {[128, 64, 32, 16].map((px) => (
            <div key={px} className="flex flex-col items-center gap-2">
              <IconPreview
                config={config}
                idPrefix={`s${px}`}
                className="rounded-[22%] ring-1 ring-border/40"
                style={{ width: px, height: px }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{px}</span>
            </div>
          ))}
        </div>
      </LabSection>

      {/* Round mask + full-bleed square */}
      <LabSection title={S.masks} note={S.masksNote}>
        <div className="flex items-center justify-center gap-6 rounded-2xl bg-muted/40 px-6 py-8">
          <div className="flex flex-col items-center gap-2">
            <IconPreview config={config} idPrefix="round" className="h-20 w-20 rounded-full ring-1 ring-border/40" />
            <span className="font-mono text-[10px] text-muted-foreground">{S.round}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <IconPreview config={config} idPrefix="square" className="h-20 w-20 ring-1 ring-border/40" />
            <span className="font-mono text-[10px] text-muted-foreground">{S.square}</span>
          </div>
        </div>
      </LabSection>
    </LabShell>
  );
}
