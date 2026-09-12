"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Command System Provider
// Controls the command palette open/close state and mode
// =============================================================================

interface CommandContextType {
  isOpen: boolean;
  isSlashCommandsMode: boolean;
  isLoadBundleMode: boolean;
  isWallpaperMode: boolean;
  openWallpaper: () => void;
  backFromWallpaper: () => void;
  open: (slashCommandsMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setSlashCommandsMode: (mode: boolean) => void;
  openLoadBundle: () => void;
  setLoadBundleMode: (mode: boolean) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function useCommand() {
  const context = useContext(CommandContext);
  if (!context) throw new Error("useCommand must be used within CommandProvider");
  return context;
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSlashCommandsMode, setIsSlashCommandsMode] = useState(false);
  const [isLoadBundleMode, setIsLoadBundleMode] = useState(false);
  const [isWallpaperMode, setIsWallpaperMode] = useState(false);
  const backFromWallpaper = useCallback(() => setIsWallpaperMode(false), []);
  const openWallpaper = useCallback(() => {
    setIsOpen(true);
    setIsWallpaperMode(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
  }, []);

  const open = useCallback((slashCommandsMode = false) => {
    setIsOpen(true);
    setIsWallpaperMode(false);
    setIsSlashCommandsMode(slashCommandsMode);
    setIsLoadBundleMode(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsWallpaperMode(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setIsWallpaperMode(false);
        setIsSlashCommandsMode(false);
        setIsLoadBundleMode(false);
      }
      return !prev;
    });
  }, []);

  const setSlashCommandsMode = useCallback((mode: boolean) => {
    setIsSlashCommandsMode(mode);
    if (mode) { setIsLoadBundleMode(false); setIsWallpaperMode(false); }
  }, []);

  const setLoadBundleMode = useCallback((mode: boolean) => {
    setIsLoadBundleMode(mode);
    if (mode) { setIsSlashCommandsMode(false); setIsWallpaperMode(false); }
  }, []);

  const openLoadBundle = useCallback(() => {
    setIsOpen(true);
    setIsWallpaperMode(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(true);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ⌘K to toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      // "/" to open command palette in slash commands mode
      if (e.key === "/" && !isInputField && !isOpen) {
        e.preventDefault();
        open(true);
        return;
      }

      // Escape: wallpaper and load-bundle return to search.
      if (e.key === "Escape" && isOpen && isWallpaperMode) {
        e.preventDefault();
        setIsWallpaperMode(false);
        return;
      }

      // Escape: load-bundle → back to search; otherwise close
      if (e.key === "Escape" && isOpen) {
        if (isLoadBundleMode) {
          e.preventDefault();
          setIsLoadBundleMode(false);
          return;
        }
        close();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoadBundleMode, isWallpaperMode, toggle, close, open]);

  return (
    <CommandContext.Provider
      value={{
        isOpen,
        isSlashCommandsMode,
        isLoadBundleMode,
        isWallpaperMode,
        openWallpaper,
        backFromWallpaper,
        open,
        close,
        toggle,
        setSlashCommandsMode,
        openLoadBundle,
        setLoadBundleMode,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}
