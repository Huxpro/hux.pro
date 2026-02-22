"use client";

import { deviceType, primaryInput } from "detect-it";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface InputCapabilityContextType {
  primaryInput: "mouse" | "touch";
  deviceType: "mouseOnly" | "touchOnly" | "hybrid";
  hasFineHoverPointer: boolean;
  hasMousePointerInteraction: boolean;
  magneticPreviewEnabled: boolean;
}

const InputCapabilityContext = createContext<
  InputCapabilityContextType | undefined
>(undefined);

function detectFineHoverPointer(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(any-hover: hover)").matches &&
    window.matchMedia("(any-pointer: fine)").matches
  );
}

export function useInputCapability() {
  const context = useContext(InputCapabilityContext);
  if (!context) {
    throw new Error(
      "useInputCapability must be used within InputCapabilityProvider",
    );
  }
  return context;
}

export function InputCapabilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasFineHoverPointer, setHasFineHoverPointer] = useState(() =>
    detectFineHoverPointer(),
  );
  const [hasMousePointerInteraction, setHasMousePointerInteraction] =
    useState(false);

  useEffect(() => {
    const mediaHover = window.matchMedia("(any-hover: hover)");
    const mediaFinePointer = window.matchMedia("(any-pointer: fine)");

    const handleMediaChange = () => {
      setHasFineHoverPointer(mediaHover.matches && mediaFinePointer.matches);
    };

    mediaHover.addEventListener("change", handleMediaChange);
    mediaFinePointer.addEventListener("change", handleMediaChange);

    return () => {
      mediaHover.removeEventListener("change", handleMediaChange);
      mediaFinePointer.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    const handlePointerSignal = (e: PointerEvent) => {
      if (e.pointerType === "mouse") {
        setHasMousePointerInteraction(true);
      }
    };

    window.addEventListener("pointermove", handlePointerSignal, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerSignal);

    return () => {
      window.removeEventListener("pointermove", handlePointerSignal);
      window.removeEventListener("pointerdown", handlePointerSignal);
    };
  }, []);

  const magneticPreviewEnabled =
    primaryInput === "mouse" ||
    hasFineHoverPointer ||
    hasMousePointerInteraction;

  const value = useMemo<InputCapabilityContextType>(
    () => ({
      primaryInput,
      deviceType,
      hasFineHoverPointer,
      hasMousePointerInteraction,
      magneticPreviewEnabled,
    }),
    [hasFineHoverPointer, hasMousePointerInteraction, magneticPreviewEnabled],
  );

  return (
    <InputCapabilityContext.Provider value={value}>
      {children}
    </InputCapabilityContext.Provider>
  );
}
