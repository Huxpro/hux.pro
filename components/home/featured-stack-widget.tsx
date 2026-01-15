"use client";

import { cn } from "@/lib/utils";
import {
  WidgetShell,
  WidgetHeader,
  WidgetTitle,
  WidgetBody,
  WidgetLink,
} from "@/components/ui/widget";
import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
    <WidgetShell className={className}>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const getStride = useCallback((): number | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    if (!card) return null;
    const gap = Number.parseFloat(getComputedStyle(el).gap || "0");
    return card.offsetWidth + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stride = getStride();
    if (!stride) return;
    const newIndex = Math.round(el.scrollLeft / stride);
    setActiveIndex(Math.min(Math.max(newIndex, 0), items.length - 1));
  }, [getStride, items.length]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const stride = getStride();
      if (!stride) return;
      el.scrollTo({ left: index * stride, behavior: "smooth" });
    },
    [getStride]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
              data-carousel-card
            >
              {child}
            </div>
          ))}
          <div className="flex-shrink-0 w-5" aria-hidden="true" />
        </div>

        {/* Dots */}
        {items.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-3">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToIndex(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-200",
                  i === activeIndex
                    ? "bg-foreground/60 w-3"
                    : "bg-foreground/20 hover:bg-foreground/40"
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
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

// Backwards-compatible alias
export const FeaturedStackWidget = HStackWidget;

