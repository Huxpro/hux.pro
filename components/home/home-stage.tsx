"use client";

import type { ReactNode } from "react";

/**
 * HomeStage — the homepage springboard.
 *
 * Identifier, greeting, and the widget board are one cluster. Their
 * internal spacing is the original HeaderZone geometry (hux in the top
 * slot, greeting centered in the remaining zone, then the masonry) and
 * does not change with viewport height. Extra canvas on a tall screen
 * becomes equal springs above and below the *whole* cluster, so the
 * grid can sit in the optical middle without the voice drifting away
 * from it.
 *
 * Springs only consume leftover space. If chrome + board + dock
 * clearance already fill the viewport, the top spring collapses to the
 * original `pt-16 / pt-24` and the page scrolls as before.
 */
export function HomeStage({ children }: { children: ReactNode }) {
  return <main className="home-stage">{children}</main>;
}

export function HomeStageCluster({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="home-stage-spring home-stage-spring-top" aria-hidden />
      <div className="home-stage-cluster">{children}</div>
      <div className="home-stage-spring" aria-hidden />
    </>
  );
}

export function HomeStageBoard({ children }: { children: ReactNode }) {
  return <div className="home-stage-board relative z-20">{children}</div>;
}
