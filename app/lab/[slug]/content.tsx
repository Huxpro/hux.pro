"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { Stage } from "@/components/lab/stage";
import type { LabType, PostLanguage } from "@/lib/content";
import type { Locale } from "@/lib/i18n";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

interface LabItemContentProps {
  slug: string;
  title: string;
  titleZh?: string;
  date: string;
  type: LabType;
  href?: string;
  credit?: string;
  locale: Locale;
  language: PostLanguage;
  children: ReactNode;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

export function LabItemContent({
  slug,
  title,
  titleZh,
  date,
  type,
  href,
  credit,
  locale,
  children,
}: LabItemContentProps) {
  const displayTitle = locale === "zh" && titleZh ? titleZh : title;

  const metaRow = (
    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground flex-wrap">
      <time>{formatDate(date)}</time>
      {credit && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span>{credit}</span>
        </>
      )}
      {href && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
          >
            source
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </>
      )}
    </div>
  );

  return (
    <PageLayout
      title={displayTitle}
      backHref="/lab"
      backLabel="/lab"
      variant="reader"
      headerActions={metaRow}
      className="min-h-screen"
    >
      {/* The embedded canvas, à la the screenshot */}
      <Stage slug={slug} type={type} href={href} title={displayTitle} className="mb-10 sm:mb-12" />

      <div className="prose-article" lang={locale}>
        {children}
      </div>
    </PageLayout>
  );
}
