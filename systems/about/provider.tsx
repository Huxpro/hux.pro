"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCommand } from "@/systems/command/provider";

export const ABOUT_DISMISSED_KEY = "hux_about_dismissed";

interface AboutContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AboutContext = createContext<AboutContextValue | null>(null);

export function useAbout() {
  const value = useContext(AboutContext);
  if (!value) throw new Error("useAbout must be used within AboutProvider");
  return value;
}

export function AboutProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const command = useCommand();
  const [isOpen, setIsOpen] = useState(false);
  const checkedVisit = useRef(false);

  useEffect(() => {
    // Defer until hydration; a blocked storage API still gets a usable intro.
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(ABOUT_DISMISSED_KEY) === "1";
    } catch {}
    const firstPage = !checkedVisit.current;
    const frame = requestAnimationFrame(() => {
      checkedVisit.current = true;
      setIsOpen(pathname === "/about" || (firstPage && !dismissed));
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  const open = useCallback(() => {
    command.close();
    setIsOpen(true);
  }, [command]);

  const close = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(ABOUT_DISMISSED_KEY, "1");
    } catch {}
    // A direct /about visit has the home screen underneath. Opening with O
    // never navigates, so an article's scroll and running apps remain intact.
    if (pathname === "/about") router.replace("/", { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role='textbox']"))
      )
        return;
      if (event.key.toLowerCase() !== "o" || command.isOpen) return;
      event.preventDefault();
      if (isOpen) close();
      else open();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, command.isOpen, open, close]);

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return (
    <AboutContext.Provider value={value}>{children}</AboutContext.Provider>
  );
}
