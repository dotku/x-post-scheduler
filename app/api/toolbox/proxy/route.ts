import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

const BLOCKED_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1])/i;

function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (BLOCKED_HOSTS.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target || !isSafeHttpUrl(target)) {
    return NextResponse.json({ error: "Invalid target url" }, { status: 400 });
  }

  try {
    const headers: HeadersInit = {};
    const range = request.headers.get("range");
    if (range) headers.Range = range;

    const upstream = await fetch(target, { headers, redirect: "follow" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const response = new NextResponse(upstream.body, { status: upstream.status });
    const passthrough = [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "etag",
      "last-modified",
    ];
    for (const key of passthrough) {
      const value = upstream.headers.get(key);
      if (value) response.headers.set(key, value);
    }
    response.headers.set("cache-control", "private, max-age=600");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy fetch failed" },
      { status: 500 }
    );
  }
}

