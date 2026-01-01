"use client";

import { useLocale } from "@/components/providers";
import { t } from "@/lib/i18n";
import type { DocPage } from "@/lib/mdx";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface DocsPageListProps {
  docs: DocPage[];
}

export function DocsPageList({ docs }: DocsPageListProps) {
  const { locale } = useLocale();
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(locale, "home")}
        </Link>

        {/* Header */}
        <header className="mb-20 text-center">
          <h1 className="text-3xl font-light tracking-tight text-foreground">
            {t(locale, "docsTitle")}
          </h1>
          <p className="mt-3 font-serif italic text-muted-foreground">
            {t(locale, "docsSubtitle")}
          </p>
        </header>

        {/* Doc list */}
        <section className="space-y-0">
          {docs.map((doc) => {
            const isHovered = hoveredSlug === doc.slug;

            return (
              <article
                key={doc.slug}
                className="group relative"
                onMouseEnter={() => setHoveredSlug(doc.slug)}
                onMouseLeave={() => setHoveredSlug(null)}
              >
                <Link
                  href={`/docs/${doc.slug}`}
                  className={cn(
                    "flex items-baseline justify-between gap-4 py-4 -mx-4 px-4 rounded-lg transition-all duration-200",
                    isHovered && "bg-muted/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-3">
                      <h2
                        className={cn(
                          "text-base font-normal transition-colors duration-200",
                          isHovered ? "text-foreground" : "text-foreground"
                        )}
                      >
                        {doc.title}
                      </h2>
                    </div>

                    {/* Hover content: description */}
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300 ease-out",
                        isHovered
                          ? "max-h-24 opacity-100 mt-2"
                          : "max-h-0 opacity-0 mt-0"
                      )}
                    >
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {doc.description}
                      </p>
                    </div>
                  </div>

                  {/* Reading time */}
                  <span className="font-mono text-sm text-muted-foreground shrink-0">
                    {doc.readingTime}
                  </span>
                </Link>
              </article>
            );
          })}
        </section>

        {docs.length === 0 && (
          <p className="text-muted-foreground text-center py-12">
            {t(locale, "noResults")}
          </p>
        )}
      </main>
    </div>
  );
}
