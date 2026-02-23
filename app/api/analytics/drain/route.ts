import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VERCEL_DRAIN_UA_PREFIX = "vercel-drain:";

type AnalyticsDrainEvent = {
  schema?: string;
  eventType?: string;
  timestamp?: number | string;
  path?: string;
  sessionId?: string | number | null;
  country?: string | null;
  userAgent?: string | null;
};

function normalizePath(raw: string | undefined) {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  return raw.slice(0, 512);
}

function trimOrNull(value: string | null | undefined, max = 512) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizeSessionId(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).slice(0, 128);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 128) : null;
  }
  return null;
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return new Date(asNumber);
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) return asDate;
  }
  return new Date();
}

function parseDrainEvents(
  rawBody: string,
  contentType: string | null,
): AnalyticsDrainEvent[] {
  const text = rawBody.trim();
  if (!text) return [];

  const isNdjson =
    contentType?.toLowerCase().includes("ndjson") ||
    (!text.startsWith("[") && text.includes("\n"));

  if (isNdjson) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as AnalyticsDrainEvent;
        } catch {
          return null;
        }
      })
      .filter((item): item is AnalyticsDrainEvent => !!item);
  }

  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as AnalyticsDrainEvent[];
  if (parsed && typeof parsed === "object")
    return [parsed as AnalyticsDrainEvent];
  return [];
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
) {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha1", secret)
    .update(rawBody)
    .digest("hex");
  const normalizedSignature = signatureHeader.startsWith("sha1=")
    ? signatureHeader.slice(5)
    : signatureHeader;
  return constantTimeEqual(normalizedSignature, expected);
}

function isMissingWebVisitRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { message?: unknown; meta?: unknown };
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  const meta = JSON.stringify(candidate.meta ?? {});
  return (
    message.includes("42P01") ||
    message.includes('relation "WebVisit" does not exist') ||
    meta.includes("42P01")
  );
}

export async function POST(request: NextRequest) {
  const verifyHeader = request.headers.get("x-vercel-verify");
  if (verifyHeader) {
    return new NextResponse("verified", {
      status: 200,
      headers: { "x-vercel-verify": verifyHeader },
    });
  }

  const rawBody = await request.text();
  let signatureVerified = false;
  const signatureSecret = process.env.VERCEL_DRAIN_SIGNATURE_SECRET?.trim();
  if (signatureSecret) {
    const signature = request.headers.get("x-vercel-signature");
    signatureVerified = verifySignature(rawBody, signature, signatureSecret);
    if (!signatureVerified) {
      return NextResponse.json(
        { ok: false, error: "invalid_signature" },
        { status: 401 },
      );
    }
  }

  const customToken = process.env.VERCEL_ANALYTICS_DRAIN_TOKEN?.trim();
  if (customToken && !signatureVerified) {
    const tokenHeader =
      request.headers.get("x-analytics-drain-token") ??
      request.headers.get("x-vercel-drain-token") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      null;
    if (!tokenHeader || tokenHeader !== customToken) {
      return NextResponse.json(
        { ok: false, error: "invalid_token" },
        { status: 401 },
      );
    }
  }

  let events: AnalyticsDrainEvent[] = [];
  try {
    events = parseDrainEvents(rawBody, request.headers.get("content-type"));
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 },
    );
  }

  const rows = events
    .filter(
      (event) => !event?.schema || event.schema.startsWith("vercel.analytics"),
    )
    .filter((event) => (event.eventType ?? "pageview") === "pageview")
    .filter((event) => typeof event.path === "string")
    .map((event) => ({
      path: normalizePath(event.path),
      referrer: null as string | null,
      sessionId: normalizeSessionId(event.sessionId),
      userAgent: trimOrNull(
        `${VERCEL_DRAIN_UA_PREFIX}${event.userAgent?.trim() || "unknown"}`,
        512,
      ),
      country: trimOrNull(event.country, 8),
      createdAt: normalizeTimestamp(event.timestamp),
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  try {
    await prisma.webVisit.createMany({ data: rows });
  } catch (error) {
    if (!isMissingWebVisitRelationError(error)) {
      console.error("Failed to ingest analytics drain payload:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    return NextResponse.json({ ok: true, skipped: true, inserted: 0 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
