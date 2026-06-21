"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  getLocalizedDescription,
  getLocalizedTitle,
  getPostHref,
  shouldShowPost,
  type LabItem,
} from "@/lib/content";
import { t, useLocale } from "@/services";
import { ArrowUpRight } from "lucide-react";
import { Link } from "next-view-transitions";

interface LabItemListProps {
  items: LabItem[];
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date
    .toLocaleDateString("en-US", { month: "short", year: "numeric" })
    .toLowerCase();
}

export function LabItemList({ items }: LabItemListProps) {
  const { locale } = useLocale();

  // Lab is small; show everything regardless of language filter.
  const visible = items.filter((item) => shouldShowPost(item, locale, true));

  return (
    <PageLayout page="lab">
      <section className="space-y-0">
        {visible.map((item) => {
          const title = getLocalizedTitle(item, locale);
          const description = getLocalizedDescription(item, locale);
          const credit =
            locale === "zh" && item.creditZh ? item.creditZh : item.credit;
          const isExternal = item.type === "external";

          const preview = (
            <div className="space-y-2 max-w-[15rem]">
              {item.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail}
                  alt={title}
                  className="w-full rounded-lg border border-border"
                />
              )}
              {description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {description}
                </p>
              )}
            </div>
          );

          const meta = (
            <span className="font-mono text-xs text-muted-foreground shrink-0 inline-flex items-center gap-1.5">
              {credit && (
                <span className="text-muted-foreground/50">{credit}</span>
              )}
              {isExternal ? (
                <span className="inline-flex items-center gap-0.5">
                  {t(locale, "labExternal")}
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              ) : (
                <time>{formatDate(item.date)}</time>
              )}
            </span>
          );

          const rowClass =
            "flex items-baseline justify-between gap-4 py-3 sm:py-4 -mx-4 px-4 rounded-lg transition-colors duration-200 hover:bg-muted/50";

          const titleEl = (
            <h2 className="text-sm sm:text-base font-normal">{title}</h2>
          );

          const row =
            isExternal && item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={rowClass}
              >
                <div className="flex-1 min-w-0">{titleEl}</div>
                {meta}
              </a>
            ) : (
              <Link href={getPostHref(item, locale, "/lab")} className={rowClass}>
                <div className="flex-1 min-w-0">{titleEl}</div>
                {meta}
              </Link>
            );

          return (
            <article key={item.slug} className="group relative">
              <MagneticPreview
                preview={preview}
                enabled={!!description || !!item.thumbnail}
              >
                {row}
              </MagneticPreview>
            </article>
          );
        })}
      </section>

      {visible.length === 0 && (
        <p className="text-muted-foreground text-center py-12">
          {t(locale, "noResults")}
        </p>
      )}
    </PageLayout>
  );
}
