import { auth0 } from "./lib/auth0-client";

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/analytics/")) {
    return;
  }
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
