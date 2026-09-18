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
// One card, mounted once (components/identity-card.tsx), opened by a tap on
// any `<handle>`, `Role:` field or role row where there is no pointer to
// hover with: `open({ identityId, roleId, anchor })`. On a desktop the same
// profile is a hover peek (components/identity-hover.tsx) and nothing here
// is called; the anchor is for the anchored popover a touch tablet gets.
//
// The profile is derived from the committed log (content/log.json) rather
// than passed in, so a trigger needs to know nothing but the two ids the
// byline already carries.
// =============================================================================

/** The full log, flattened once for the lifetime of the module. */
const LOG: LogData = normalizeLogData(logJson as unknown as RawLogData);

/**
 * The profile for an identity, derived on demand. Used by the hover peek,
 * which mounts only while the pointer is over a handle, so the derivation
 * happens for the one identity being looked at rather than for every row.
 */
export function useIdentityProfile(
  identityId: string,
  roleId: string | undefined,
): IdentityProfile | null {
  const { locale } = useLocale();
  return useMemo(
    () => buildIdentityProfile(LOG, identityId, roleId, locale),
    [identityId, roleId, locale],
  );
}

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
