"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { WidgetScrollRow } from "@/components/ui/widget-scroll-row";
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
  if (items.length === 0) return null;

  return (
    <StackShell title={title} href={href} className={className}>
      <WidgetScrollRow count={items.length}>
        {items.map((child, i) => (
          <div
            key={i}
            // Show 1 item with a peek of the next
            className="snap-start shrink-0 w-[86%] sm:w-[78%] max-w-[200px]"
            data-carousel-card
          >
            {child}
          </div>
        ))}
      </WidgetScrollRow>
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

