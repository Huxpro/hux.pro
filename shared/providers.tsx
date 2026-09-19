"use client";

import { queryClient, queryPersister } from "@/lib/query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import {
  GlassProvider,
  InputCapabilityProvider,
  LocaleProvider,
  ThemeProvider,
  useTheme,
  VisitorProvider,
} from "@/services";

import { SystemSonner } from "@/components/ui/system-sonner";
import { AmbientProvider } from "@/systems/ambient/provider";
import { CommandProvider, useCommand } from "@/systems/command/provider";
import { DevtoolProvider } from "@/systems/devtool/provider";
import { MusicProvider } from "@/systems/music/provider";
import { TheaterProvider } from "@/systems/theater/provider";
import { WindowProvider } from "@/systems/windows/provider";

// =============================================================================
// Internal Wrappers
// wrappers that handle cross-provider dependencies.
// =============================================================================

function AmbientWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return <AmbientProvider theme={theme}>{children}</AmbientProvider>;
}

function DevtoolWrapper({ children }: { children: React.ReactNode }) {
  const { isOpen: isCommandOpen, close: closeCommand } = useCommand();

  return (
    <DevtoolProvider isCommandOpen={isCommandOpen} closeCommand={closeCommand}>
      {children}
    </DevtoolProvider>
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
          <GlassProvider>
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
          </GlassProvider>
        </ThemeProvider>
      </InputCapabilityProvider>
    </PersistQueryClientProvider>
  );
}
