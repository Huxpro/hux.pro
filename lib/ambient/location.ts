export type LocationMode = "ip" | "accurate";
export type LocationSource = "ip" | "geolocation";

export type ResolvedLocation = {
  source: LocationSource;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  updatedAt: number; // epoch ms
};

type IpWhoIsResponse = {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  city?: string;
  region?: string;
  country?: string;
  message?: string;
};

export async function fetchIpLocation(options?: {
  timeoutMs?: number;
}): Promise<ResolvedLocation> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://ipwho.is/", {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ipwho.is: HTTP ${res.status}`);
    const data = (await res.json()) as IpWhoIsResponse;
    if (data.success === false) {
      throw new Error(data.message || "ipwho.is: request failed");
    }
    const lat = data.latitude ?? data.lat;
    const lon = data.longitude ?? data.lon;
    if (typeof lat !== "number" || typeof lon !== "number") {
      throw new Error("ipwho.is: missing coordinates");
    }
    return {
      source: "ip",
      lat,
      lon,
      city: data.city,
      region: data.region,
      country: data.country,
      updatedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestAccurateLocation(options?: {
  timeoutMs?: number;
}): Promise<ResolvedLocation> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  if (typeof window === "undefined") {
    throw new Error("geolocation unavailable on server");
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

  // Best-effort reverse geocode so the UI can show a city name (like loe).
  // We keep this optional to avoid hard failures due to network/CORS/rate-limits.
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
  // Nominatim (OpenStreetMap) reverse geocoding.
  // Note: browsers can't reliably set a custom User-Agent header; this is best-effort.
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
  // UI convention: keep location compact; city is sufficient for the weather widget.
  // Fall back to region/country if city is missing.
  return loc.city ?? loc.region ?? loc.country ?? null;
}
