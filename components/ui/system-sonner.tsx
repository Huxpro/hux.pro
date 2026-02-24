"use client";

import { Toaster, toast } from "sonner";
import type { ReactElement } from "react";

/**
 * Distance (in px) from the bottom of the viewport to the bottom edge of the
 * FAB / toast layer.  This value is shared between the Sonner `<Toaster>`
 * offset and the FAB's Tailwind `bottom-6` (1.5rem = 24px at default font
 * size) so that language-conflict dialogs, language-switch toasts, and the
 * command FAB all sit at the same baseline.
 *
 * Keep in sync with `FloatingActionButton` in `systems/command/fab.tsx`.
 */
export const BOTTOM_OFFSET_PX = 24;

/**
 * System Sonner - Headless toast provider with custom styling
 *
 * Uses Sonner in unstyled mode so we can render custom toast UI
 * that matches the system design language.
 */
export function SystemSonner() {
  return (
    <Toaster
      position="bottom-center"
      offset={BOTTOM_OFFSET_PX}
      gap={8}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "w-full flex justify-center pointer-events-auto",
        },
      }}
    />
  );
}

/**
 * Show a custom toast with full control over the UI
 */
export function showCustomToast(
  content: ReactElement | ((id: string | number) => ReactElement),
  options?: {
    duration?: number;
    id?: string;
  }
) {
  return toast.custom(
    (id) => (typeof content === "function" ? content(id) : content),
    {
      duration: options?.duration ?? Infinity,
      id: options?.id,
    }
  );
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id?: string | number) {
  toast.dismiss(id);
}

// Re-export toast for advanced usage
export { toast };
