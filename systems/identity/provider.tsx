"use client";

import logJson from "@/content/log.json";
import { normalizeLogData, type LogData, type RawLogData } from "@/lib/log";
import { useLocale } from "@/services";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { buildIdentityProfile, type IdentityProfile } from "./lib/profile";

// =============================================================================
// IdentityCardProvider — the identity card's state.
//
// One card, mounted once (components/identity-card.tsx), opened from any
// `<handle>`, `Role:` field or role row on the site: `open({ identityId,
// roleId, anchor })`. The anchor is the element that was pressed — on a
// desktop the card is a popover hanging off it, the GitHub hovercard; on a
// phone it is a sheet and the anchor is not used.
//
// The profile is derived from the committed log (content/log.json) rather
// than passed in, so a trigger needs to know nothing but the two ids the
// byline already carries.
// =============================================================================

/** The full log, flattened once for the lifetime of the module. */
const LOG: LogData = normalizeLogData(logJson as unknown as RawLogData);

export interface OpenIdentityCard {
  identityId: string;
  /** The role instance to lead with; the identity's latest otherwise. */
  roleId?: string;
  /** What was pressed — the popover hangs off it. */
  anchor?: HTMLElement | null;
}

interface IdentityCardContextValue {
  open: (request: OpenIdentityCard) => void;
  close: () => void;
  isOpen: boolean;
  /** The card's current profile; it stays through the close animation. */
  profile: IdentityProfile | null;
  /** The element the popover shape hangs off. */
  anchorRef: RefObject<HTMLElement | null>;
}

const IdentityCardContext = createContext<IdentityCardContextValue | null>(null);

export function useIdentityCard(): IdentityCardContextValue {
  const ctx = useContext(IdentityCardContext);
  if (!ctx) {
    throw new Error("useIdentityCard must be used within IdentityCardProvider");
  }
  return ctx;
}

/** Non-throwing variant for rows that render with or without the card. */
export function useOptionalIdentityCard(): IdentityCardContextValue | null {
  return useContext(IdentityCardContext);
}

export function IdentityCardProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const [request, setRequest] = useState<OpenIdentityCard | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);

  const profile = useMemo(
    () =>
      request
        ? buildIdentityProfile(LOG, request.identityId, request.roleId, locale)
        : null,
    [request, locale],
  );

  const open = useCallback((next: OpenIdentityCard) => {
    anchorRef.current = next.anchor ?? null;
    setRequest(next);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<IdentityCardContextValue>(
    () => ({ open, close, isOpen: isOpen && !!profile, profile, anchorRef }),
    [open, close, isOpen, profile],
  );

  return (
    <IdentityCardContext.Provider value={value}>
      {children}
    </IdentityCardContext.Provider>
  );
}
