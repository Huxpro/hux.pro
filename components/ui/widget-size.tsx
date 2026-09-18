"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Size } from "./widget-grid";

// =============================================================================
// Widget size context — what a widget knows about its own footprint.
//
// Android's contract, verbatim: "The user resizes the widget … the system
// provides the new sizes, and your app must adapt to those size ranges." The
// grid is the system here. It resolves each widget's *effective* footprint —
// the visitor's choice, clamped to the widget's range and to the columns the
// viewport actually has — and hands it down through this context. A widget
// reads it with `useWidgetSize()` and picks a representation; it never sets
// its own size.
//
// The value is the effective size, not the saved one: a 2-wide widget on a
// phone is told it is 1 wide, because that is what it has to draw.
// =============================================================================

const WidgetSizeContext = createContext<Size | null>(null);

export function WidgetSizeProvider({
  size,
  children,
}: {
  size: Size;
  children: ReactNode;
}) {
  return (
    <WidgetSizeContext.Provider value={size}>
      {children}
    </WidgetSizeContext.Provider>
  );
}

const ONE_BY_ONE: Size = { w: 1, h: 1 };

/**
 * The footprint this widget currently occupies, in cells. Outside a grid
 * (previews, tests) it is `fallback`, 1×1 by default.
 */
export function useWidgetSize(fallback: Size = ONE_BY_ONE): Size {
  return useContext(WidgetSizeContext) ?? fallback;
}
