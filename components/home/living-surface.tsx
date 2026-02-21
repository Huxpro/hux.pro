"use client";

import { useLocale, t } from "@/services";
import { getLocalizedDescription, getLocalizedTitle, getPostHref } from "@/lib/content";
import { blogPosts } from "@/lib/data";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function LivingSurface() {
  const { locale } = useLocale();

  // Get the most recent blog post
  // Assuming blogPosts are sorted by date desc, which they seem to be in data.ts
  const latestPost = blogPosts[0];

  if (!latestPost) return null;

  return (
    <div className="w-full max-w-md mx-auto my-12 animate-in slide-in-from-bottom-4 fade-in duration-1000 delay-300">
      <Link
        href={getPostHref(latestPost, locale, "/writing")}
        className={cn(
          "block p-6 rounded-2xl",
          "bg-card/50 backdrop-blur-sm border border-border/40",
          "hover:bg-card/80 hover:border-border/60 hover:scale-[1.02] hover:shadow-lg",
          "transition-all duration-500 ease-out cursor-pointer",
          "group"
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {t(locale, "blog")}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {latestPost.date}
            </span>
          </div>

          <div>
            <h3 className="text-xl font-serif text-foreground group-hover:text-primary transition-colors">
              {getLocalizedTitle(latestPost, locale)}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {getLocalizedDescription(latestPost, locale)}
            </p>
          </div>

          <div className="pt-2 flex items-center text-xs text-muted-foreground font-medium opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
             Read more →
          </div>
        </div>
      </Link>
    </div>
  );
}
