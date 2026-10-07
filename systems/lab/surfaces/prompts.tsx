"use client";

import { useLabStrings } from "../i18n";
import promptsJson from "@/content/prompts.json";
import type { RawPromptsData } from "@/lib/prompts";
import { MAX_VOICES, convictionStats } from "@/lib/prompts-lab";
import { PROMPT_TOPICS, topicLabel } from "@/lib/prompt-view";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

const data = promptsJson as unknown as RawPromptsData;
const stats = convictionStats(data);
const instances = stats.reduce((n, s) => n + s.instances, 0);
const most = Math.max(...stats.map((s) => s.instances), 1);

/** The Prompts Lab at a glance: the three shelves, each entry a bar as long as its instances. */
export function PromptsSurface() {
  const { locale } = useLocale();
  const S = useLabStrings(SURFACE_STRINGS);
  return (
    <SurfaceFrame className="flex flex-col justify-center px-4 py-3">
      <div className="grid grid-cols-3 gap-3">
        {PROMPT_TOPICS.map((topic) => (
          <div key={topic} className="min-w-0 space-y-1">
            <p className={cn(TYPE.labelSm, "truncate")}>{topicLabel(topic, locale)}</p>
            {stats
              .filter((s) => s.topic === topic)
              .map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <span className="flex shrink-0 gap-px">
                    {Array.from({ length: MAX_VOICES }, (_, i) => (
                      <span
                        key={i}
                        className={cn("size-1 rounded-full", i < s.voices ? "bg-foreground/70" : "bg-foreground/15")}
                      />
                    ))}
                  </span>
                  <span
                    className="h-1 rounded-full bg-foreground/40"
                    style={{ width: `${Math.max(8, (s.instances / most) * 100)}%` }}
                  />
                </div>
              ))}
          </div>
        ))}
      </div>
      <p className={cn(TYPE.labelSm, "mt-2.5 truncate")}>{S.promptsSummary(stats.length, instances)}</p>
    </SurfaceFrame>
  );
}
