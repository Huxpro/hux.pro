"use client";

import { queryClient, queryPersister } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

// Services (simple UI-less state providers)
import {
  defaultLocale,
  localeNames,
  LocaleProvider,
  locales,
  t,
  ThemeProvider,
  translations,
  useLocale,
  useTheme,
  useVisitor,
  VisitorProvider,
  type LastVisitedItem,
  type Locale,
  type TranslationKey,
} from "@/services";

// Systems
import {
  AmbientProvider,
  useAmbientTime,
  useLocation,
  useWeather,
} from "@/systems/ambient";
import {
  CommandProvider,
  useCommand,
  useCommandPalette,
} from "@/systems/command";
import { DevtoolProvider, useDebug, useDevtool } from "@/systems/devtool";

// Re-export hooks for backward compatibility
export {
  defaultLocale,
  localeNames,
  locales,
  t,
  translations,
  useAmbientTime,
  // Systems
  useCommand,
  useCommandPalette,
  useDebug,
  useDevtool,
  useLocale,
  useLocation,
  // Services
  useTheme,
  useVisitor,
  useWeather,
  type LastVisitedItem,
  type Locale,
  type TranslationKey,
};

// =============================================================================
// Internal Wrappers
// wrappers that handle cross-provider dependencies.
// =============================================================================

function AmbientWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return <AmbientProvider theme={theme}>{children}</AmbientProvider>;
}

function DevtoolWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen: isCommandOpen } = useCommand();

  return (
    <DevtoolProvider isCommandOpen={isCommandOpen}>{children}</DevtoolProvider>
  );
}

// =============================================================================
// Root Providers
// root context orchestrator.
// =============================================================================

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister }}
      >
        <ThemeProvider>
          <LocaleProvider>
            <VisitorProvider>
              <CommandProvider>
                <DevtoolWrapper>
                  <AmbientWrapper>{children}</AmbientWrapper>
                </DevtoolWrapper>
              </CommandProvider>
            </VisitorProvider>
          </LocaleProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  );
}
