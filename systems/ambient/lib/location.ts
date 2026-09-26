export type LocationMode = "ip" | "accurate";
export type LocationSource = "ip" | "geolocation";

export type ResolvedLocation = {
  source: LocationSource;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  /** Which service answered (an IP provider, or "geolocation"). For the devtool. */
  provider?: string;
  /** IANA zone the IP provider placed the address in, when it says. */
  timezone?: string;
  /**
   * The IP provider put this address in a different UTC offset from the
   * browser's own clock — so the address is almost certainly placed in the
   * wrong city (a carrier gateway, a relay, a VPN). The coordinates are still
   * the best we have; this only says not to trust them much.
   */
  timezoneMismatch?: boolean;
  updatedAt: number;
};

type IpLocationResponse = {
  // ipapi.co fields
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
  error?: boolean;
  // ipwho.is fields
  success?: boolean;
  lat?: number;
  lon?: number;
  country?: string;
  message?: string;
  // ipapi.co: a string; ipwho.is: an object
  timezone?: string | { id?: string };
};

type IpProvider = {
  url: string;
  name: string;
  parse: (data: IpLocationResponse) => {
    lat: number;
    lon: number;
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  };
};

function timezoneOf(data: IpLocationResponse): string | undefined {
  const tz = data.timezone;
  if (typeof tz === "string") return tz || undefined;
  return typeof tz?.id === "string" && tz.id ? tz.id : undefined;
}

const IP_PROVIDERS: IpProvider[] = [
  {
    url: "https://ipapi.co/json/",
    name: "ipapi.co",
    parse: (data) => {
      if (data.error) throw new Error("ipapi.co: request failed");
      const lat = data.latitude;
      const lon = data.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") {
        throw new Error("ipapi.co: missing coordinates");
      }
      return {
        lat,
        lon,
        city: data.city,
        region: data.region,
        country: data.country_name,
        timezone: timezoneOf(data),
      };
    },
  },
  {
    url: "https://ipwho.is/",
    name: "ipwho.is",
    parse: (data) => {
      if (data.success === false) {
        throw new Error(data.message || "ipwho.is: request failed");
      }
      const lat = data.latitude ?? data.lat;
      const lon = data.longitude ?? data.lon;
      if (typeof lat !== "number" || typeof lon !== "number") {
        throw new Error("ipwho.is: missing coordinates");
      }
      return {
        lat,
        lon,
        city: data.city,
        region: data.region,
        country: data.country,
        timezone: timezoneOf(data),
      };
    },
  },
];

/** Minutes east of UTC that `timeZone` is at `atMs`, or null for an unknown zone. */
function utcOffsetMinutes(timeZone: string, atMs: number): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(new Date(atMs));
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute")
    );
    const minuteMs = Math.floor(atMs / 60_000) * 60_000;
    const offset = Math.round((asUtc - minuteMs) / 60_000);
    return Number.isFinite(offset) ? offset : null;
  } catch {
    return null;
  }
}

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Does the IP's zone disagree with the browser's clock? Offsets are compared,
 * not names, so aliases (US/Pacific vs America/Los_Angeles) and neighbours in
 * the same offset agree. Unknown on either side is not a disagreement.
 */
export function isTimezoneMismatch(
  ipTimezone: string | undefined,
  nowMs: number = Date.now(),
  localTimezone: string | undefined = browserTimezone()
): boolean {
  if (!ipTimezone || !localTimezone) return false;
  const a = utcOffsetMinutes(ipTimezone, nowMs);
  const b = utcOffsetMinutes(localTimezone, nowMs);
  return a !== null && b !== null && a !== b;
}

/**
 * Where the IP address says the visitor is.
 *
 * IP databases misplace whole carriers: a phone on cellular in San Jose can
 * come back as Dallas, and so can Private Relay or a VPN. The browser's own
 * clock is a free second opinion — so a provider that puts the address in a
 * different UTC offset is doubted and the next one asked. If every provider
 * disagrees with the clock, the first answer is kept and flagged
 * (`timezoneMismatch`); the permission prompt reads that as its cue.
 */
export async function fetchIpLocation(options?: {
  timeoutMs?: number;
}): Promise<ResolvedLocation> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  let lastError: Error | undefined;
  let doubted: ResolvedLocation | undefined;

  for (const provider of IP_PROVIDERS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(provider.url, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${provider.name}: HTTP ${res.status}`);
      const data = (await res.json()) as IpLocationResponse;
      const parsed = provider.parse(data);
      const resolved: ResolvedLocation = {
        source: "ip",
        ...parsed,
        provider: provider.name,
        updatedAt: Date.now(),
      };
      if (!isTimezoneMismatch(parsed.timezone)) return resolved;
      doubted ??= { ...resolved, timezoneMismatch: true };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timeout);
    }
  }

  if (doubted) return doubted;
  throw lastError ?? new Error("All IP location providers failed");
}

export async function requestAccurateLocation(options?: {
  timeoutMs?: number;
}): Promise<ResolvedLocation> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  if (typeof window === "undefined") {
    throw new Error("geolocation unavailable on server");
  }
  if (window.isSecureContext === false) {
    throw new Error("geolocation requires a secure context (HTTPS)");
  }
  if (!("geolocation" in navigator)) {
    throw new Error("geolocation unsupported");
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("geolocation timeout")), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timeout);
        resolve(p);
      },
      (e) => {
        clearTimeout(timeout);
        reject(e);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: timeoutMs }
    );
  });

  let city: string | undefined;
  let country: string | undefined;
  try {
    const result = await reverseGeocodeNominatim(
      pos.coords.latitude,
      pos.coords.longitude
    );
    city = result.city;
    country = result.country;
  } catch {
    // ignore
  }

  return {
    source: "geolocation",
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    city,
    country,
    provider: "geolocation",
    updatedAt: Date.now(),
  };
}

type ReverseGeocodeResult = {
  city?: string;
  country?: string;
};

async function reverseGeocodeNominatim(
  lat: number,
  lon: number
): Promise<ReverseGeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "10");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("reverse geocoding failed");
  type NominatimReverseResponse = {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      country?: string;
    };
  };
  const data = (await res.json()) as NominatimReverseResponse;
  const address = data.address;

  return {
    city: address?.city || address?.town || address?.village,
    country: address?.country,
  };
}

export function formatLocationLabel(loc: Pick<
  ResolvedLocation,
  "city" | "region" | "country"
>): string | null {
  return loc.city ?? loc.region ?? loc.country ?? null;
}
