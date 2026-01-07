export function isWeatherGradientEnabledForPath(pathname: string): boolean {
  // v1: enable only on home route
  if (!pathname) return false;
  return pathname === "/" || pathname === "";
}
