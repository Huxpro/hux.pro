"use client";

import { SurfaceFrame } from "./frame";

/**
 * The Door at a glance: the wardrobe, already a little open.
 * The piece itself plays in the lab and in the home-screen app.
 * A card this small cannot hold the eight seconds, so it holds the door.
 */
export function DoorSurface() {
  return (
    <SurfaceFrame className="bg-[#14110e]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#2a241f_0%,#14110e_70%)]" />
      <div className="absolute left-[18%] top-[14%] h-[70%] w-[30%] bg-[#1c1815] shadow-[inset_0_0_0_3px_#0c0a09]">
        <div className="absolute inset-[3px] bg-[#0c0b0a]" />
        <div
          className="absolute inset-[3px] origin-left bg-gradient-to-r from-[#1a1613] to-[#241e1a]"
          style={{ transform: "perspective(180px) rotateY(-34deg)" }}
        />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[28%] bg-gradient-to-t from-[#0c0a09] to-transparent" />
    </SurfaceFrame>
  );
}
