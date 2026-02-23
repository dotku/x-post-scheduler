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
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  console.log(`[BlobProxy] Request for: ${blobUrl.substring(0, 80)}...`);
  console.log(`[BlobProxy] Token present: ${!!token}, Token length: ${token?.length || 0}`);

  if (!blobUrl || !sig || !Number.isFinite(exp)) {
    return NextResponse.json(
      { error: "Invalid signature parameters" },
      { status: 400 },
    );
  }

  if (!isLikelyBlobUrl(blobUrl)) {
    return NextResponse.json({ error: "Invalid blob url" }, { status: 400 });
  }

  const ok = verifySignedBlobProxyParams({ blobUrl, exp, sig });
  if (!ok) {
    return NextResponse.json(
      { error: "Expired or invalid signature" },
      { status: 403 },
    );
  }

  try {
    const fetchHeaders: HeadersInit = {};
    // Only add authorization if we have a token and the URL is private
    // But since we are proxying, we assume we might need it for private blobs.
    // Public blobs ignore the token usually, or we can check if it's private.
    if (token) {
      fetchHeaders["Authorization"] = `Bearer ${token}`;
    }

    // Forward range header for video seeking support
    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }

    const response = await fetch(blobUrl, { headers: fetchHeaders });

    if (!response.ok && response.status !== 206) {
      console.error(
        `[BlobProxy] Upstream error: ${response.status} ${response.statusText}`,
      );
      if (response.status === 404) {
        return NextResponse.json({ error: "Blob not found" }, { status: 404 });
      }
      if (response.status === 403) {
        return NextResponse.json(
          { error: "Blob access forbidden - check token" },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }

    const validHeaders = new Headers();
    const contentType = response.headers.get("content-type");
    if (contentType) validHeaders.set("content-type", contentType);
    const contentLength = response.headers.get("content-length");
    if (contentLength) validHeaders.set("content-length", contentLength);
    const contentRange = response.headers.get("content-range");
    if (contentRange) validHeaders.set("content-range", contentRange);
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges) validHeaders.set("accept-ranges", acceptRanges);

    validHeaders.set("cache-control", "public, max-age=300");

    return new NextResponse(response.body, {
      status: response.status, // Preserve 206 for partial content
      headers: validHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blob" },
      { status: 500 },
    );
  }
}
