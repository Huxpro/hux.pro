"use client";

import { useLocale } from "@/components/providers";
import { SystemNav } from "@/components/ui/system-nav";
import { t } from "@/lib/i18n";
import type { TalkWithContent } from "@/lib/mdx";
import { FileText, Play } from "lucide-react";

interface TalksListProps {
  talks: TalkWithContent[];
}

export function TalksList({ talks }: TalksListProps) {
  const { locale } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-16 pb-24">
        {/* Back link - System UI */}
        <SystemNav href="/" path="λhux" className="mb-12" />

        {/* Header */}
        <header className="mb-16">
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
            {t(locale, "talksTitle")}
          </h1>
        </header>

        {/* Talks grid */}
        <section className="space-y-10">
          {talks.map((talk) => {
            const title =
              locale === "zh" && talk.titleZh ? talk.titleZh : talk.title;
            const description =
              locale === "zh" && talk.descriptionZh
                ? talk.descriptionZh
                : talk.description;

            return (
              <article key={talk.slug} className="group">
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground mb-2">
                  <time>{talk.date}</time>
                  <span className="text-border">·</span>
                  <span>{talk.event}</span>
                  <span className="text-border">·</span>
                  <span>{talk.location}</span>
                </div>

                {/* Title */}
                <h2 className="text-xl font-medium text-foreground">{title}</h2>

                {/* Description */}
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  {description}
                </p>

                {/* Links */}
                <div className="mt-4 flex items-center gap-4">
                  {talk.video && (
                    <a
                      href={talk.video}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-muted-foreground transition-colors"
                    >
                      <Play className="h-4 w-4" />
                      {t(locale, "watch")}
                    </a>
                  )}
                  {talk.slides && (
                    <a
                      href={talk.slides}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-muted-foreground transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      {t(locale, "slides")}
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
