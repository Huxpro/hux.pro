"use client";

import { SystemNav } from "@/components/ui/system-nav";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageLayoutProps {
  /** Page title - displayed in the header h1 */
  title: string;
  /** Back navigation href, defaults to "/" */
  backHref?: string;
  /** Back navigation label, defaults to "λhux" */
  backLabel?: string;
  /** Additional className for the main element */
  className?: string;
  /** Page content */
  children: ReactNode;
}

/**
 * PageLayout - Shared layout for content pages
 *
 * Provides consistent structure across prose, log, prompt, and docs pages:
 * - Centered container (max-w-[680px])
 * - SystemNav back navigation
 * - Page header with title
 * - View Transition API integration for smooth page transitions
 *
 * The layout elements have view-transition-name properties that match
 * corresponding elements on the home page, enabling smooth morphing
 * animations when navigating between pages.
 */
export function PageLayout({
  title,
  backHref = "/",
  backLabel = "λhux",
  className,
  children,
}: PageLayoutProps) {
  return (
    <main className={cn("mx-auto max-w-[680px] px-6 pt-24 pb-32", className)}>
      {/* Back link - System UI */}
      <SystemNav href={backHref} path={backLabel} className="mb-16" />

      {/* Header */}
      <header className="mb-20">
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
          {title}
        </h1>
      </header>

      {children}
    </main>
  );
}
