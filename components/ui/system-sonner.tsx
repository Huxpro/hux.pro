"use client";

import { Toaster, toast } from "sonner";
import type { ReactNode } from "react";

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
      offset={24}
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
  content: ReactNode | ((id: string | number) => ReactNode),
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
