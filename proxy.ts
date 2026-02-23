import { auth0 } from "./lib/auth0-client";
import { NextResponse } from "next/server";

const NON_LOCALE_PREFIXES = ["/api/", "/auth/", "/_next/", "/_vercel/"];

function isStaticFile(pathname: string) {
  return /\.[^/]+$/.test(pathname);
}

/**
 * Locale routing for next-intl "as-needed" prefix mode:
 * - /zh/... → pass through (locale=zh in URL segment)
 * - /en/... → redirect to /... (strip redundant default-locale prefix)
 * - /...    → rewrite internally to /en/... so [locale] segment = "en"
 */
function handleLocaleRouting(request: Request): Response | undefined {
  const url = new URL(request.url);
  const { pathname } = url;

  // Skip non-page paths
  if (NON_LOCALE_PREFIXES.some((p) => pathname.startsWith(p))) return undefined;
  if (isStaticFile(pathname)) return undefined;

  // /en/... → redirect to /... (canonical)
  if (pathname.startsWith("/en/") || pathname === "/en") {
    const stripped = pathname.slice(3) || "/";
    url.pathname = stripped;
    return NextResponse.redirect(url.toString(), 308);
  }

  // /zh/... → already has locale prefix, pass through
  if (pathname.startsWith("/zh/") || pathname === "/zh") {
    return undefined;
  }

  // Default: rewrite /path → /en/path so [locale] receives "en"
  const rewriteUrl = new URL(request.url);
  rewriteUrl.pathname = `/en${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(rewriteUrl.toString());
}

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith("/api/analytics/")) return;

  const localeResponse = handleLocaleRouting(request);
  if (localeResponse) return localeResponse;

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
