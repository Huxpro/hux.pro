"use client";

/**
 * The session's answer to the scale the /works log is set at — the devtool's
 * Works module (systems/devtool), read by every part of a row that moves
 * with it (the title, the sentence, the covers, the spacing) so they move
 * together. The default when the devtool is off or absent. A trial, not a
 * setting: nothing here persists.
 */

import {
  useOptionalDevtool,
  WORKS_SCALE_DEFAULT,
  type WorksScale,
} from "@/systems/devtool/provider";

export function useWorksScale(): WorksScale {
  const devtool = useOptionalDevtool();
  return devtool?.isEnabled ? devtool.worksScale : WORKS_SCALE_DEFAULT;
}
