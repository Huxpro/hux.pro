"use client";

// =============================================================================
// Capture: the scene, measured, once per still.
//
// The Wardrobe runs in a frame the size it was composed for (390 × 844), out
// of sight. Through window.__scene it goes to each still; the snapshot says
// where every thing is (the pick buffer's visible boxes, its parts, the room's
// whole extent), and the svg itself is copied out, its ids prefixed, so the
// wall can show it through any number of viewBoxes at the cost of one <use>.
// Then the frame is let go.
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneApi, Snapshot } from "scene";
import { KEY_PART, THINGS, type Box, type Capture } from "./host";

export const STILLS = ["gap", "bedside", "door"] as const;
export type StillName = (typeof STILLS)[number];

export interface Captured extends Capture {
  /** The still's svg, ids prefixed with `cap-<still>-`: for <use href="#cap-<still>">. */
  markup: string;
  /** The root svg's own filter (the dream's colour). */
  filter: string;
  label: string;
}

const box = (b: { x0: number; y0: number; x1: number; y1: number } | null | undefined): Box | null =>
  b ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : null;

function prefixIds(markup: string, prefix: string): string {
  return markup
    .replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`)
    .replace(/url\(#([^)"']+)\)/g, `url(#${prefix}$1)`)
    .replace(/url\(&quot;#([^&]+)&quot;\)/g, `url(&quot;#${prefix}$1&quot;)`)
    .replace(/\b(xlink:)?href="#([^"]+)"/g, `$1href="#${prefix}$2"`);
}

function thingsOf(snap: Snapshot): Capture["things"] {
  const out: Capture["things"] = {};
  for (const inst of snap.instances) {
    if (!(THINGS as readonly string[]).includes(inst.entity) || !inst.visible) continue;
    const part = KEY_PART[inst.entity as keyof typeof KEY_PART];
    const key = part ? box(inst.parts.find((p) => p.path === `${inst.path}.${part}`)?.visible) : null;
    out[inst.entity] = { box: box(inst.visible)!, key };
  }
  return out;
}

const frames = (n: number) => new Promise<void>((r) => (function step(k: number) { if (k <= 0) r(); else requestAnimationFrame(() => step(k - 1)); })(n));

/**
 * The stills of a scene, captured. Render `frame` somewhere (it is invisible);
 * `captures` fills in once the scene has been measured.
 */
export function useCaptures(src: string): { captures: Captured[] | null; frame: ReactNode; error: string | null } {
  const ref = useRef<HTMLIFrameElement>(null);
  const [captures, setCaptures] = useState<Captured[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Wait for the scene to open itself.
      let api: SceneApi | undefined;
      for (let i = 0; i < 200 && !api && !cancelled; i++) {
        api = ref.current?.contentWindow?.__scene;
        if (!api) await new Promise((r) => setTimeout(r, 50));
      }
      if (!api || cancelled) {
        if (!cancelled) setError("scene did not open");
        return;
      }
      const labels = Object.fromEntries(api.stills().map((s) => [s.name, s.label ?? s.name]));
      const out: Captured[] = [];
      for (const still of STILLS) {
        api.goto(still);
        await frames(3);
        await new Promise((r) => setTimeout(r, 60));
        const snap = await api.snapshot();
        const svg = ref.current?.contentDocument?.querySelector<SVGSVGElement>(".stage svg");
        if (!svg) continue;
        const room = snap.instances.find((i) => i.entity === "room")?.geometry;
        const frame = { x0: snap.frame.x, y0: snap.frame.y, x1: snap.frame.x + snap.frame.width, y1: snap.frame.y + snap.frame.height };
        out.push({
          still,
          label: labels[still] ?? still,
          frame,
          extent: box(room) ?? frame,
          things: thingsOf(snap),
          markup: prefixIds(svg.innerHTML, `cap-${still}-`),
          filter: svg.style.filter || "none",
        });
      }
      if (!cancelled) {
        setCaptures(out);
        setDone(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [src]);

  const frame = done ? null : (
    <iframe
      ref={ref}
      src={src}
      title="scene"
      aria-hidden
      tabIndex={-1}
      // In view (so the browser keeps drawing it) and invisible.
      style={{ position: "fixed", left: 0, top: 0, width: 390, height: 844, opacity: 0, pointerEvents: "none", border: 0, zIndex: -1 }}
    />
  );
  return { captures, frame, error };
}

/** The captured stills as one hidden svg of symbols, for the wall's <use>s. */
export function CaptureDefs({ captures }: { captures: Captured[] }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        {captures.map((c) => (
          <g key={c.still} id={`cap-${c.still}`} dangerouslySetInnerHTML={{ __html: c.markup }} />
        ))}
      </defs>
    </svg>
  );
}
