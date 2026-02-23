import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth0 } from "@/lib/auth0-client";

function normalizePath(raw: string | undefined) {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  return raw.slice(0, 512);
}

function trimOrNull(value: string | undefined, max = 512) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function isMissingWebVisitRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; meta?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const meta = JSON.stringify(candidate.meta ?? {});
  return (
    message.includes("42P01") ||
    message.includes('relation "WebVisit" does not exist') ||
    meta.includes("42P01")
  );
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    referrer?: string;
    sessionId?: string;
  };

  const path = normalizePath(body.path);
  const referrer = trimOrNull(body.referrer, 1024);
  const sessionId = trimOrNull(body.sessionId, 128);
  const userAgent = trimOrNull(request.headers.get("user-agent") ?? undefined, 512);
  const country = trimOrNull(
    request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry") ??
      undefined,
    8
  );

  let userId: string | null = null;
  const session = await auth0.getSession();
  const sub = session?.user?.sub;
  if (sub) {
    const user = await prisma.user.findUnique({
      where: { auth0Sub: sub },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO "WebVisit" ("path", "referrer", "sessionId", "userAgent", "country", "userId")
      VALUES (${path}, ${referrer}, ${sessionId}, ${userAgent}, ${country}, ${userId})
    `;
  } catch (error) {
    if (!isMissingWebVisitRelationError(error)) {
      console.error("Failed to insert pageview:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    // Migration not applied yet; keep endpoint non-breaking.
    return NextResponse.json({ ok: true, skipped: true });
  }

  return NextResponse.json({ ok: true });
}
