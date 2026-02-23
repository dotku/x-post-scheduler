import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

function isSafeHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
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

