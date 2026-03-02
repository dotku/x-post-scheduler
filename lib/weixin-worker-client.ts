/**
 * HTTP client for the Weixin Playwright worker on Fly.io.
 */

const WORKER_URL = process.env.WEIXIN_WORKER_URL || "http://localhost:8080";
const WORKER_SECRET = process.env.WEIXIN_WORKER_SECRET || "";

function authHeaders(userId?: string): HeadersInit {
  const headers: Record<string, string> = {};
  if (WORKER_SECRET) headers["Authorization"] = `Bearer ${WORKER_SECRET}`;
  if (userId) headers["X-User-Id"] = userId;
  return headers;
}

function jsonHeaders(userId?: string): HeadersInit {
  return {
    ...authHeaders(userId),
    "Content-Type": "application/json",
  };
}

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Worker returned non-JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * Wake the worker machine if it's auto-stopped on Fly.io.
 * Retries the health endpoint until it responds (up to ~60s).
 */
async function ensureWorkerAwake(): Promise<void> {
  const maxAttempts = 6;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${WORKER_URL}/health`, {
        headers: authHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return;
    } catch {
      // Machine still starting, wait and retry
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  // Don't throw — let the actual request try anyway
  console.warn("[weixin-worker] Could not confirm worker is awake, proceeding anyway");
}

// --- QR Login ---

export interface QrLoginStartResult {
  sessionId: string;
  qrCodeBase64: string;
  expiresAt: string;
}

export async function startQrLogin(userId?: string): Promise<QrLoginStartResult> {
  await ensureWorkerAwake();
  const res = await fetch(`${WORKER_URL}/qr-login/start`, {
    method: "POST",
    headers: authHeaders(userId),
    signal: AbortSignal.timeout(120000),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error(json.error || `Worker error ${res.status}`);
  }
  return json;
}

export interface QrLoginStatusResult {
  status: "pending" | "scanned" | "success" | "expired";
  message?: string;
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
}

export async function getQrLoginStatus(
  sessionId: string
): Promise<QrLoginStatusResult> {
  const res = await fetch(
    `${WORKER_URL}/qr-login/${sessionId}/status`,
    { headers: authHeaders() }
  );
  const json = await parseJson(res);
  if (!res.ok) {
    throw new Error(json.error || `Worker error ${res.status}`);
  }
  return json;
}

// --- Channel Scraping ---

export interface VideoMeta {
  title: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  objectId?: string;
  exportId?: string;
  duration?: number;
}

export interface ThumbnailData {
  url: string;
  base64: string;
  altText?: string;
}

export interface ScrapeChannelResult {
  success: boolean;
  content?: string;
  title?: string;
  videos?: VideoMeta[];
  images?: Array<{ url: string; altText?: string }>;
  thumbnails?: ThumbnailData[];
  error?: string;
  cookieExpired?: boolean;
}

export async function scrapeChannel(
  cookies: Array<Record<string, unknown>>,
  channelId?: string,
  userId?: string
): Promise<ScrapeChannelResult> {
  await ensureWorkerAwake();
  const res = await fetch(`${WORKER_URL}/scrape/channel`, {
    method: "POST",
    headers: jsonHeaders(userId),
    body: JSON.stringify({ cookies, channelId }),
    signal: AbortSignal.timeout(300000), // 5 min for scraping (navigation + rendering can be slow)
  });
  const json = await parseJson(res);
  if (!res.ok && !json.success) {
    throw new Error(json.error || `Worker error ${res.status}`);
  }
  return json;
}

// --- Video URL Resolution ---

export interface ResolveVideoUrlsResult {
  results: Array<{
    title: string;
    objectId?: string;
    videoUrl?: string;
    error?: string;
  }>;
}

export async function resolveVideoUrls(
  cookies: Array<Record<string, unknown>>,
  videos: Array<{ objectId?: string; title: string }>,
  userId?: string
): Promise<ResolveVideoUrlsResult> {
  await ensureWorkerAwake();
  const res = await fetch(`${WORKER_URL}/resolve/video-urls`, {
    method: "POST",
    headers: jsonHeaders(userId),
    body: JSON.stringify({ cookies, videos }),
    signal: AbortSignal.timeout(300000), // 5 min — navigating multiple detail pages
  });
  const json = await parseJson(res);
  if (!res.ok && !json.results) {
    throw new Error(json.error || `Worker error ${res.status}`);
  }
  return json;
}

// --- Video Download ---

export interface DownloadVideoResult {
  success: boolean;
  data?: string; // base64 encoded
  contentType?: string;
  filename?: string;
  size?: number;
  error?: string;
}

export async function downloadVideo(
  cookies: Array<Record<string, unknown>>,
  videoUrl: string,
  filename?: string,
  userId?: string
): Promise<DownloadVideoResult> {
  const res = await fetch(`${WORKER_URL}/download/video`, {
    method: "POST",
    headers: jsonHeaders(userId),
    body: JSON.stringify({ cookies, videoUrl, filename }),
    signal: AbortSignal.timeout(300000), // 5 min for large videos
  });
  const json = await parseJson(res);
  if (!res.ok && !json.success) {
    throw new Error(json.error || `Worker error ${res.status}`);
  }
  return json;
}
