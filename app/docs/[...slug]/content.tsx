"use client";

import { useLocale } from "@/components/providers";
import { t } from "@/lib/i18n";
import Link from "next/link";
import type { ReactNode } from "react";

interface DocContentProps {
  title: string;
  readingTime?: string;
  children: ReactNode; // Server-rendered MDX content
}

export function DocContent({ title, readingTime, children }: DocContentProps) {
  const { locale } = useLocale();

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-[680px] px-6 pt-16 pb-32">
        {/* Back link - quiet, almost invisible */}
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors mb-12"
        >
          <span>←</span>
          <span>{t(locale, "backToDocs")}</span>
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-normal text-foreground leading-tight tracking-tight mb-4">
            {title}
          </h1>
          {readingTime && (
            <div className="font-mono text-xs text-muted-foreground">
              <span>{readingTime}</span>
            </div>
          )}
        </header>

        {/* Server-rendered MDX Content */}
        <div className="prose-article">{children}</div>
      </article>
    </div>
  );
}
