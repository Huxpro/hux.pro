"use client";

import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useLynxApps } from "../provider";

const AppWindow = dynamic(
  () => import("./app-window").then((m) => m.AppWindow),
  { ssr: false },
);

/**
 * Renders floating app windows (Lynx bundles + web iframes) above the page.
 */
export function LynxWindowManager() {
  const { windows } = useLynxApps();

  return (
    <AnimatePresence>
      {windows.map((win) => (
        <AppWindow key={win.instanceId} win={win} />
      ))}
    </AnimatePresence>
  );
}
