// =============================================================================
// Route Gradient Configuration
// =============================================================================

import type { Locale } from "@/services/locale";

export const GRADIENT_ROUTE_DEFAULTS: Record<string, boolean> = {
  "/": true,
  "/prose": false,
  "/prose/*": false,
  "/docs": false,
  "/docs/*": false,
  "/career": false,
  "/productions": false,
  "/projects": false,
  "/blog": false,
  "/blog/*": false,
  "/*": true,
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

export function getRouteGradientDefault(pattern: string): boolean {
  return GRADIENT_ROUTE_DEFAULTS[pattern] ?? GRADIENT_ROUTE_DEFAULTS["/*"];
}

export function getRoutePatternLabel(pattern: string, locale: Locale): string {
  const labels: Record<string, { en: string; zh: string }> = {
    "/": { en: "Home", zh: "首页" },
    "/prose": { en: "Prose", zh: "散文" },
    "/prose/*": { en: "Prose Posts", zh: "散文文章" },
    "/docs": { en: "Docs", zh: "文档" },
    "/docs/*": { en: "Doc Pages", zh: "文档页面" },
    "/career": { en: "Career", zh: "职业" },
    "/productions": { en: "Productions", zh: "作品" },
    "/projects": { en: "Projects", zh: "项目" },
    "/blog": { en: "Blog (legacy)", zh: "博客（旧）" },
    "/blog/*": { en: "Blog Posts (legacy)", zh: "博客文章（旧）" },
    "/*": { en: "Other (404)", zh: "其他（404）" },
  };

  return labels[pattern]?.[locale] ?? pattern;
}
