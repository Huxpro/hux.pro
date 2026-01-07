export type StoredWithExpiry<T> = {
  value: T;
  expiresAt: number; // epoch ms
};

export function getStoredWithExpiry<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWithExpiry<T>;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function setStoredWithExpiry<T>(
  key: string,
  value: T,
  ttlMs: number
): void {
  if (typeof window === "undefined") return;
  const payload: StoredWithExpiry<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore quota / serialization errors
  }
}
