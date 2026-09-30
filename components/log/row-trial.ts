"use client";

/**
 * The session's answer to how a /works row's description prints — the
 * devtool's Works module (systems/devtool), read by the row's title and its
 * sentence so the two move together. The default when the devtool is off
 * or absent. A trial, not a setting: nothing here persists.
 */

import { useOptionalDevtool } from "@/systems/devtool/provider";
import {
  WORKS_DESCRIPTION_DEFAULT,
  type WorksDescription,
} from "@/systems/devtool/provider";

export function useWorksDescription(): WorksDescription {
  const devtool = useOptionalDevtool();
  return devtool?.isEnabled ? devtool.worksDescription : WORKS_DESCRIPTION_DEFAULT;
}
