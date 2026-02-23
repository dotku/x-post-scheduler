import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

function extractBlobUrl(inputUrl: string): string | null {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.pathname === "/api/toolbox/blob-proxy") {
      const raw = parsed.searchParams.get("u");
      if (!raw) return null;
      const decoded = decodeURIComponent(raw);
      const target = new URL(decoded);
      if (!target.hostname.endsWith(".blob.vercel-storage.com")) return null;
      return target.toString();
    }
    if (parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { inputUrl?: string };
  const inputUrl = body.inputUrl?.trim();
  if (!inputUrl) {
    return NextResponse.json({ ok: true, deleted: false, reason: "missing_input_url" });
  }

  const blobUrl = extractBlobUrl(inputUrl);
  if (!blobUrl) {
    return NextResponse.json({ ok: true, deleted: false, reason: "not_blob_url" });
  }

  try {
    await del(blobUrl);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, deleted: false, error: error instanceof Error ? error.message : "Failed to delete blob" },
      { status: 500 }
    );
  }
}

