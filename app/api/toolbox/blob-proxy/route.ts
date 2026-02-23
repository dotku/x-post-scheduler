import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { verifySignedBlobProxyParams } from "@/lib/blob-proxy";

function isLikelyBlobUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const blobUrl = request.nextUrl.searchParams.get("u") || "";
  const expRaw = request.nextUrl.searchParams.get("exp") || "";
  const sig = request.nextUrl.searchParams.get("sig") || "";
  const exp = Number(expRaw);

  if (!blobUrl || !sig || !Number.isFinite(exp)) {
    return NextResponse.json({ error: "Invalid signature parameters" }, { status: 400 });
  }

  if (!isLikelyBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Invalid blob url" }, { status: 400 });
  }

  const ok = verifySignedBlobProxyParams({ blobUrl, exp, sig });
  if (!ok) {
    return NextResponse.json({ error: "Expired or invalid signature" }, { status: 403 });
  }

  try {
    const result = await get(blobUrl, { access: "private" });
    if (!result) {
      return NextResponse.json({ error: "Blob not found" }, { status: 404 });
    }
    if (result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Blob unavailable" }, { status: 404 });
    }
    const { stream, headers } = result;
    const response = new NextResponse(stream, { status: 200 });
    const contentType = headers.get("content-type");
    if (contentType) response.headers.set("content-type", contentType);
    const contentLength = headers.get("content-length");
    if (contentLength) response.headers.set("content-length", contentLength);
    response.headers.set("cache-control", "public, max-age=300");
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch blob" },
      { status: 500 }
    );
  }
}
