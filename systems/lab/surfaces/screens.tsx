"use client";

import { SurfaceFrame } from "./frame";

/**
 * One Dream, Any Screen at a glance: one composition (a wardrobe, him, his
 * hat) through three screens, framed three ways: a phone crops, a square
 * steps back into the room, a monitor letterboxes. The same three words the
 * lab's tiles wear.
 */
export function ScreensSurface() {
  const screens = [
    { w: 38, h: 82, view: "0 0 390 844", label: "crop", fit: "xMidYMid slice" },
    { w: 72, h: 72, view: "-120 120 630 630", label: "step", fit: "xMidYMid slice" },
    { w: 120, h: 68, view: "0 0 390 844", label: "whole", fit: "xMidYMid meet" },
  ];
  return (
    <SurfaceFrame className="flex items-end justify-center gap-3 px-4 pb-4">
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          <g id="screens-surface-scene">
            <rect x="-300" y="-200" width="990" height="840" fill="#0e1426" />
            <rect x="-300" y="640" width="990" height="400" fill="#080b15" />
            <rect x="40" y="172" width="112" height="214" fill="#2c3a5e" />
            <circle cx="122" cy="214" r="13" fill="#b9c5e6" opacity="0.6" />
            <rect x="205" y="212" width="161" height="430" fill="#1a2440" />
            <rect x="213" y="222" width="73" height="418" fill="#18213a" stroke="#060910" />
            <polygon points="358,222 330,232 330,630 358,640" fill="#121a2e" />
            <g fill="#000" transform="translate(236 872) scale(1.9)">
              <path d="M -27 -381 C -29 -404 -17 -419 0 -419 C 17 -419 29 -404 27 -381 Z" />
              <ellipse cx="0" cy="-379" rx="72" ry="8.5" />
              <ellipse cx="0" cy="-362" rx="12" ry="17" />
              <path d="M -24 -338 Q -28 -300 -19 -240 L -29 0 L 29 0 L 19 -240 Q 28 -300 24 -338 Z" />
              <circle cx="-4.6" cy="-361.5" r="1.4" fill="#d3dcf2" />
              <circle cx="4.4" cy="-362" r="1.4" fill="#d3dcf2" />
            </g>
            <path d="M -40 760 C 40 724 120 742 170 716 C 214 694 250 690 286 704 C 330 722 360 708 430 716 L 430 900 L -40 900 Z" fill="#141c33" />
          </g>
        </defs>
      </svg>
      {screens.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-1.5">
          <svg viewBox={s.view} preserveAspectRatio={s.fit} width={s.w} height={s.h} className="rounded-[5px] bg-black ring-1 ring-border/60" aria-hidden>
            <use href="#screens-surface-scene" />
          </svg>
          <span className="font-mono text-[10px] text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </SurfaceFrame>
  );
}
