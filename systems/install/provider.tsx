"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  detectInstallGuide,
  getDeferredPrompt,
  subscribeInstall,
  wasInstalledThisSession,
  type InstallGuide,
} from "./lib/platform";

// =============================================================================
// Install — the state behind the "Add to Home Screen" command.
//
// Open state lives here rather than in the sheet, for the reason the tilt
// primer's lives in the ambient provider: the command that opens it is in the
// palette, and the sheet is mounted in the layout.
// =============================================================================

interface InstallContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /**
   * Which directions apply here. Settled after mount (the server cannot know)
   * and read again on every open: a tab that has since become an installed
   * window should not go on describing the browser it came from.
   */
  guide: InstallGuide;
  /** The browser has handed us its install dialog to open (Chromium). */
  canPrompt: boolean;
  /**
   * Installed from this tab since it loaded — `appinstalled` fired. The tab
   * itself is still a tab (the app opened in a window of its own), so `guide`
   * cannot say so; this can.
   */
  installed: boolean;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

export function useInstall() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("useInstall must be used within InstallProvider");
  return context;
}

const serverSnapshot = () => false;
const hasDeferredPrompt = () => getDeferredPrompt() !== null;

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  // The server's guess, until the client says otherwise; the palette that
  // shows it never renders on the server anyway.
  const [guide, setGuide] = useState<InstallGuide>("desktop-chrome");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only read
    setGuide(detectInstallGuide());
  }, []);

  const canPrompt = useSyncExternalStore(subscribeInstall, hasDeferredPrompt, serverSnapshot);
  const installed = useSyncExternalStore(
    subscribeInstall,
    wasInstalledThisSession,
    serverSnapshot
  );

  const open = useCallback(() => {
    setGuide(detectInstallGuide());
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, open, close, guide, canPrompt, installed }),
    [isOpen, open, close, guide, canPrompt, installed]
  );

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}
