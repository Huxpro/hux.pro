"use client";

import {
  type Locale,
  defaultLocale,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Theme context
interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within Providers");
  return context;
}

// Locale context
interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within Providers");
  return context;
}

// Command palette context
interface CommandPaletteContextType {
  isOpen: boolean;
  isActionMode: boolean;
  open: (actionMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setActionMode: (mode: boolean) => void;
}

const CommandPaletteContext = createContext<
  CommandPaletteContextType | undefined
>(undefined);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context)
    throw new Error("useCommandPalette must be used within Providers");
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isActionMode, setIsActionMode] = useState(false);
  const router = useRouter();

  // Initialize theme from system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setTheme(mediaQuery.matches ? "dark" : "light");
    };
    // Set initial theme
    updateTheme();
    // Listen for system theme changes
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Initialize locale
  useEffect(() => {
    setTimeout(() => setLocaleState(getStoredLocale()), 0);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  const openCommand = useCallback((actionMode = false) => {
    setIsCommandOpen(true);
    setIsActionMode(actionMode);
  }, []);
  const closeCommand = useCallback(() => {
    setIsCommandOpen(false);
    setIsActionMode(false);
  }, []);
  const toggleCommand = useCallback(() => {
    setIsCommandOpen((prev) => {
      if (prev) setIsActionMode(false);
      return !prev;
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields (except for command palette)
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      const isCommandPaletteInput = target.closest("[cmdk-root]") !== null;

      // ⌘K to toggle command palette (search mode)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommand();
        return;
      }

      // "/" to open command palette in action mode (when not in input field)
      if (e.key === "/" && !isInputField && !isCommandOpen) {
        e.preventDefault();
        openCommand(true);
        return;
      }

      // Escape to close command palette
      if (e.key === "Escape" && isCommandOpen) {
        closeCommand();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCommandOpen, toggleCommand, closeCommand, openCommand]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <LocaleContext.Provider value={{ locale, setLocale }}>
        <CommandPaletteContext.Provider
          value={{
            isOpen: isCommandOpen,
            isActionMode,
            open: openCommand,
            close: closeCommand,
            toggle: toggleCommand,
            setActionMode: setIsActionMode,
          }}
        >
          {children}
        </CommandPaletteContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}
