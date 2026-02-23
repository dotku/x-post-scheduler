import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_SECONDS = 20 * 60;

function getSigningSecret() {
  return process.env.BLOB_PROXY_SECRET || process.env.AUTH0_SECRET || process.env.AUTH_SECRET;
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function buildSignedBlobProxyUrl(
  origin: string,
  blobUrl: string,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("Missing BLOB_PROXY_SECRET (or AUTH0_SECRET) for private blob proxy");
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${blobUrl}:${exp}`;
  const sig = signPayload(payload, secret);
  return `${origin}/api/toolbox/blob-proxy?u=${encodeURIComponent(blobUrl)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedBlobProxyParams(params: {
  blobUrl: string;
  exp: number;
  sig: string;
}) {
  const secret = getSigningSecret();
  if (!secret) return false;
  if (!Number.isFinite(params.exp) || params.exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }
  const payload = `${params.blobUrl}:${params.exp}`;
  const expected = signPayload(payload, secret);
  if (expected.length !== params.sig.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(params.sig));
}

