// =============================================================================
// Route Gradient Configuration
// =============================================================================

// Device form factor type
export type FormFactor = "desktop" | "mobile";

// Route gradient config can be a boolean or device-specific
export type RouteGradientConfig =
  | boolean
  | { desktop: boolean; mobile: boolean };

export const GRADIENT_ROUTE_DEFAULTS: Record<string, RouteGradientConfig> = {
  "/": { desktop: true, mobile: false },
  "/writing": false,
  "/writing/*": false,
  "/works": false,
  "/docs": false,
  "/docs/*": false,
  "/*": { desktop: true, mobile: false },
};

export const KNOWN_ROUTE_PATTERNS = Object.keys(GRADIENT_ROUTE_DEFAULTS).filter(
  (p) => p !== "/*"
);

export function matchRoutePattern(pathname: string): string {
  if (!pathname) return "/*";

  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  if (GRADIENT_ROUTE_DEFAULTS[normalized] !== undefined) {
    return normalized;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length > 0) {
    for (let i = segments.length - 1; i >= 0; i--) {
      const parentPath = "/" + segments.slice(0, i).join("/");
      const wildcardPattern =
        parentPath === "/" ? "/*" : `${parentPath}/*`.replace("//", "/");

      if (GRADIENT_ROUTE_DEFAULTS[wildcardPattern] !== undefined) {
        return wildcardPattern;
      }
    }
  }

  return "/*";
}

// Resolve a route config to a boolean based on form factor
function resolveRouteConfig(
  config: RouteGradientConfig,
  formFactor: FormFactor
): boolean {
  if (typeof config === "boolean") {
    return config;
  }
  return config[formFactor];
}

export function getRouteGradientDefault(
  pattern: string,
  formFactor: FormFactor = "desktop"
): boolean {
  const config =
    GRADIENT_ROUTE_DEFAULTS[pattern] ?? GRADIENT_ROUTE_DEFAULTS["/*"];
  return resolveRouteConfig(config, formFactor);
}
