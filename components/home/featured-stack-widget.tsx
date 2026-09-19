"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { PagerDots, useSnapPager } from "@/components/ui/snap-pager";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

type FeaturedStackWidgetProps = {
  title: string;
  href?: string;
  children: React.ReactNode[];
  className?: string;
};

function StackShell({
  title,
  href,
  className,
  children,
}: {
  title: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <WidgetShell className={className} href={href}>
      <WidgetHeader>
        <WidgetTitle>{title}</WidgetTitle>
        {href ? (
          <WidgetLink href={href} />
        ) : (
          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        )}
      </WidgetHeader>
      {children}
    </WidgetShell>
  );
}

export function HStackWidget({
  title,
  href,
  children,
  className,
}: FeaturedStackWidgetProps) {
  const items = useMemo(() => children.filter(Boolean), [children]);
  // The snap track, the in-view index and the dots are the shared pager
  // (components/ui/snap-pager) — the same strip the attachment surface pages.
  const { scrollRef, index, scrollTo } = useSnapPager(items.length);

  if (items.length === 0) return null;

  return (
    <StackShell title={title} href={href} className={className}>
      {/* Body wrapper owns bottom padding (works even without dots) */}
      <div className="pb-5">
        {/* Horizontal snapping stack */}
        <div
          ref={scrollRef}
          className={cn(
            "pl-5 pr-5",
            "overflow-x-auto",
            "flex gap-3",
            "snap-x snap-mandatory",
            "scroll-pl-5",
            "scroll-smooth",
            // Hide scrollbars
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {items.map((child, i) => (
            <div
              key={i}
              className={cn(
                "snap-start shrink-0",
                // Show 1 item with a peek of the next
                "w-[86%] sm:w-[78%] max-w-[200px]"
              )}
              data-pager-card
            >
              {child}
            </div>
          ))}
          <div className="flex-shrink-0 w-5" aria-hidden="true" />
        </div>

        {/* Dots */}
        <PagerDots
          count={items.length}
          index={index}
          onSelect={scrollTo}
          label={(page) => `Go to slide ${page}`}
          className="pt-3"
        />
      </div>
    </StackShell>
  );
}

export function VStackWidget({
  title,
  href,
  children,
  className,
}: FeaturedStackWidgetProps) {
  const items = useMemo(() => children.filter(Boolean), [children]);
  if (items.length === 0) return null;

  return (
    <StackShell title={title} href={href} className={className}>
      <WidgetBody className="space-y-3">
        {items.map((child, i) => (
          <div key={i}>{child}</div>
        ))}
      </WidgetBody>
    </StackShell>
  );
}

