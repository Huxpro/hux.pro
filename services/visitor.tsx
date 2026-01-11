"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Visitor Service
// Tracks returning visitors and last-read content for personalized greetings
// =============================================================================

export interface LastVisitedItem {
  slug: string;
  title: string;
  type: "blog" | "talk";
}

interface VisitorContextType {
  lastVisited: LastVisitedItem | null;
  lastVisitTime: number | null;
  isReturningVisitor: boolean;
  daysSinceLastVisit: number | null;
  recordVisit: (item: LastVisitedItem) => void;
  recordPageView: () => void;
}

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

export function useVisitor() {
  const context = useContext(VisitorContext);
  if (!context) throw new Error("useVisitor must be used within VisitorProvider");
  return context;
}

// =============================================================================
// Visitor Storage Helpers
// =============================================================================

const VISITOR_STORAGE_KEY = "hux_visitor";

interface VisitorStorage {
  lastVisited: LastVisitedItem | null;
  lastVisitTime: number;
}

function getVisitorStorage(): VisitorStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setVisitorStorage(data: VisitorStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(data));
}

export function VisitorProvider({ children }: { children: React.ReactNode }) {
  const [lastVisited, setLastVisited] = useState<LastVisitedItem | null>(null);
  const [lastVisitTime, setLastVisitTime] = useState<number | null>(null);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);

  useEffect(() => {
    const stored = getVisitorStorage();
    if (stored) {
      setLastVisited(stored.lastVisited);
      setLastVisitTime(stored.lastVisitTime);
      setIsReturningVisitor(true);
    }
  }, []);

  const daysSinceLastVisit = lastVisitTime
    ? Math.floor((Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24))
    : null;

  const recordVisit = useCallback((item: LastVisitedItem) => {
    setLastVisited(item);
    const now = Date.now();
    setLastVisitTime(now);
    setVisitorStorage({ lastVisited: item, lastVisitTime: now });
  }, []);

  const recordPageView = useCallback(() => {
    const now = Date.now();
    const stored = getVisitorStorage();
    setVisitorStorage({
      lastVisited: stored?.lastVisited || null,
      lastVisitTime: now,
    });
  }, []);

  return (
    <VisitorContext.Provider
      value={{
        lastVisited,
        lastVisitTime,
        isReturningVisitor,
        daysSinceLastVisit,
        recordVisit,
        recordPageView,
      }}
    >
      {children}
    </VisitorContext.Provider>
  );
}
