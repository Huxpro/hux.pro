"use client";

import { ArrowUpRight, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { experienceById, type LabId } from "../catalog";
import { useLabStrings, type LabTable } from "../i18n";
import { LabButton, LabShell, labButtonClass } from "./shell";

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
// =============================================================================

const en = {
  replay: "Replay",
  open: "Full screen",
};

const zh: typeof en = {
  replay: "重来",
  open: "全屏",
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
  children,
}: {
  lab: LabId;
  /** How it is played, one line under the story: what to press, how often. */
  how?: ReactNode;
  /** The story, in the reader's language: a title and a few paragraphs. */
  children: ReactNode;
}) {
  const lab = experienceById(id);
  const { locale } = useLocale();
  const S = useLabStrings(STRINGS);
  const [run, setRun] = useState(0);
  const src = experienceSrc(lab.experience.src, locale);

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
    <LabShell lab={id} layout="canvas" actions={actions}>
      <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-[2.25rem] border border-border/60 bg-black shadow-overlay",
            "aspect-[390/844] h-[min(74svh,780px)] max-w-full",
          )}
        >
          <iframe
            key={`${locale}:${run}`}
            src={src}
            title={lab.name[locale]}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay"
          />
        </div>
        <article lang={locale} className="ink-bare w-full max-w-md space-y-5 lg:pt-10">
          {children}
          {how && <p className={cn(TYPE.meta, "pt-3")}>{how}</p>}
        </article>
      </div>
    </LabShell>
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
