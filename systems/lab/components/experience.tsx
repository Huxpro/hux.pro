"use client";

import { ArrowUpRight, RotateCcw, ScanSearch } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import type { LanguageLayer } from "scene";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { experienceById, type LabId } from "../catalog";
import { useLabStrings, type LabTable } from "../i18n";
import { InspectorOverlay, InspectorPanel, useInspection } from "./inspector";
import { LabButton, LabChip, LabShell, labButtonClass } from "./shell";

// =============================================================================
// The experience template: a feeling, a few seconds long, beside the story
// it came from.
//
// An experience is one document in `public/` (the catalog's `experience.src`),
// whole on its own: the home folder opens the same page as an app in a window
// (content/apps.json, `experience.app`). Here it stands in a phone-shaped
// frame, because that is the shape it is made for, with the story it tells
// in words beside it (below it, on a phone). Replay starts it over; the
// arrow opens it on its own, full screen.
//
// The document follows the reader's language through `?lang=`, and starts
// over when it changes.
//
// An experience built on packages/scene, given its language layer, can also
// be inspected: the bar's Inspect switch lays the running scene open beside
// the frame (components/inspector.tsx) in place of the story.
// =============================================================================

const en = {
  replay: "Replay",
  open: "Full screen",
  inspect: "Inspect",
};

const zh: typeof en = {
  replay: "重来",
  open: "全屏",
  inspect: "检查",
};

const STRINGS: LabTable<typeof en> = { en, zh };

/** The document's address in a language, with whatever else it is asked to do. */
export function experienceSrc(src: string, lang: string, extra?: Record<string, string>) {
  const query = new URLSearchParams({ lang, ...extra });
  return `${src}?${query}`;
}

export function ExperienceShell({
  lab: id,
  how,
  language,
  children,
}: {
  lab: LabId;
  /** How it is played, one line under the story: what to press, how often. */
  how?: ReactNode;
  /** The words it came from and what they meant: given, the scene can be inspected. */
  language?: LanguageLayer;
  /** The story, in the reader's language: a title and a few paragraphs. */
  children: ReactNode;
}) {
  const lab = experienceById(id);
  const { locale } = useLocale();
  const S = useLabStrings(STRINGS);
  const [run, setRun] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const src = experienceSrc(lab.experience.src, locale);

  const tools = language ? (
    <LabChip on={inspecting} onClick={() => setInspecting((v) => !v)}>
      <ScanSearch />
      {S.inspect}
    </LabChip>
  ) : undefined;

  const actions = (
    <>
      <LabButton onClick={() => setRun((n) => n + 1)}>
        <RotateCcw />
        {S.replay}
      </LabButton>
      <a href={src} target="_blank" rel="noopener" className={labButtonClass()}>
        <ArrowUpRight />
        {S.open}
      </a>
    </>
  );

  return (
    <LabShell lab={id} layout="canvas" tools={tools} actions={actions}>
      {/* Keyed, so a replay or a new language is a fresh frame and a fresh inspection. */}
      <Body key={`${locale}:${run}`} src={src} title={lab.name[locale]} inspecting={inspecting && !!language} language={language}>
        <article lang={locale} className="ink-bare w-full max-w-md space-y-5 lg:pt-10">
          {children}
          {how && <p className={cn(TYPE.meta, "pt-3")}>{how}</p>}
        </article>
      </Body>
    </LabShell>
  );
}

function Body({ src, title, inspecting, language, children }: { src: string; title: string; inspecting: boolean; language?: LanguageLayer; children: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const inspection = useInspection(frame);
  return (
    <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-[2.25rem] border border-border/60 bg-black shadow-overlay",
          "aspect-[390/844] h-[min(74svh,780px)] max-w-full",
          inspecting && "lg:sticky lg:top-[var(--lab-under-bar)]",
        )}
      >
        <iframe ref={frame} src={src} title={title} className="absolute inset-0 h-full w-full border-0" allow="autoplay" />
        {inspecting && <InspectorOverlay inspection={inspection} />}
      </div>
      {inspecting && language ? (
        <div className="w-full min-w-0 max-w-2xl">
          <InspectorPanel inspection={inspection} language={language} />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** The story's title: serif, the size of a thought rather than a heading. */
export function ExperienceTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-serif text-2xl leading-snug text-foreground">{children}</h1>;
}

/** One paragraph of the story. */
export function ExperienceProse({ children }: { children: ReactNode }) {
  return (
    <p className="font-serif text-base leading-loose text-reading-foreground [&:lang(en)]:text-[1.0625rem]">
      {children}
    </p>
  );
}
