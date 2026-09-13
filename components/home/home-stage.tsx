"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * HomeStage — the homepage springboard.
 *
 * On short viewports (phone, tablet, typical laptop) the stage is just the
 * existing top-aligned stack: identifier, greeting, widgets, then dock
 * clearance. Extra height is what iPadOS does when the same home screen
 * lands on an iPad Pro — leftover canvas becomes *stage margin* that
 * optically centers the widget board between the voice and the search bar,
 * and a large-canvas density pass widens the board and opens the gaps so
 * the extra pixels are used, not left as a void.
 *
 * The centering is flex-grow, not a height media query, so it cannot
 * regress a screen that already fills: if chrome + board + dock clearance
 * exceed the viewport, the board-area stays content-sized and the page
 * scrolls exactly as before.
 */
export function HomeStage({ children }: { children: ReactNode }) {
  return <main className="home-stage">{children}</main>;
}

export function HomeStageChrome({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="home-stage-chrome hero-zone-fade sticky top-0 z-10"
      style={style}
    >
      <div className="home-stage-voice">{children}</div>
    </div>
  );
}

export function HomeStageBoard({ children }: { children: ReactNode }) {
  return (
    <div className="home-stage-board-area">
      <div className="home-stage-board relative z-20">{children}</div>
    </div>
  );
}
