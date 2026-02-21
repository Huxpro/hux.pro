import { NextResponse, type NextRequest } from "next/server";

const DEFAULT_LOCALE = "en";
const LOCALES = new Set(["en", "zh"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Don't redirect if the last segment is already a locale
  const lastSegment = pathname.split("/").pop();
  if (lastSegment && LOCALES.has(lastSegment)) {
    return NextResponse.next();
  }

  // Read user's preferred locale from cookie, fall back to default
  const locale = request.cookies.get("locale")?.value || DEFAULT_LOCALE;

  // Redirect bare URL to locale-suffixed URL
  const url = request.nextUrl.clone();
  url.pathname = `${pathname}/${locale}`;
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: [
    // Match /writing/slug and /writing/slug/lang
    "/writing/:path+",
    // Match /docs/slug+ (catch-all)
    "/docs/:path+",
  ],
};
