"use client";

import { queryClient, queryPersister } from "@/lib/query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import {
  InputCapabilityProvider,
  LocaleProvider,
  ThemeProvider,
  useTheme,
  VisitorProvider,
} from "@/services";

import { SystemSonner } from "@/components/ui/system-sonner";
import { AmbientProvider } from "@/systems/ambient";
import { CommandProvider, useCommand } from "@/systems/command";
import { DevtoolProvider } from "@/systems/devtool";
import { MusicProvider } from "@/systems/music";
import { TheaterProvider } from "@/systems/theater";
import { WallpaperProvider } from "@/systems/wallpaper";
import { WindowProvider } from "@/systems/windows";

// =============================================================================
// Internal Wrappers
// wrappers that handle cross-provider dependencies.
// =============================================================================

function AmbientWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <AmbientProvider theme={theme}>
      <WallpaperProvider>{children}</WallpaperProvider>
    </AmbientProvider>
  );
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister }}
    >
      <InputCapabilityProvider>
        <ThemeProvider>
          <LocaleProvider>
            <VisitorProvider>
              <CommandProvider>
                <DevtoolWrapper>
                  <AmbientWrapper>
                    <MusicProvider>
                      <TheaterProvider>
                        <WindowProvider>
                          {children}
                          <SystemSonner />
                        </WindowProvider>
                      </TheaterProvider>
                    </MusicProvider>
                  </AmbientWrapper>
                </DevtoolWrapper>
              </CommandProvider>
            </VisitorProvider>
          </LocaleProvider>
        </ThemeProvider>
      </InputCapabilityProvider>
    </PersistQueryClientProvider>
  );
}
