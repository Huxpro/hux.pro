"use client";

import { useCommand } from "@/systems/command";
import dynamic from "next/dynamic";

/** The activity, loaded the first time Ask is called (AI Elements,
 *  streamdown, the AI SDK client are none of the page's business until then). */
const Activity = dynamic(() => import("./components/activity"), { ssr: false });

/**
 * Ask's place in the Dock (components/activity.tsx). Renders nothing, and
 * loads nothing, until something calls Ask (`askCall` in the command
 * provider); from then on the activity decides when it shows.
 */
export function AskActivity() {
  const { askCall } = useCommand();
  return askCall ? <Activity /> : null;
}
