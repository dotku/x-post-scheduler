import { put, del } from "@vercel/blob";
import { prisma } from "./db";

const RETRYABLE_FETCH_STATUSES = new Set([403, 404, 408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempts = 5, baseDelayMs = 800) {
  let lastStatus: number | null = null;

  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return response;
      lastStatus = response.status;
      if (!RETRYABLE_FETCH_STATUSES.has(response.status) || i === attempts - 1) {
        break;
      }
    } catch {
      if (i === attempts - 1) break;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(baseDelayMs * (i + 1));
  }

  throw new Error(
    lastStatus ? `Failed to fetch media (${lastStatus})` : "Failed to fetch media"
  );
}

function isPrivateStoreAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("private store") && message.includes("public access");
}

function getExtFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "jpg";
    case "image/png":  return "png";
    case "image/webp": return "webp";
    case "image/gif":  return "gif";
    case "image/avif": return "avif";
    case "video/mp4":  return "mp4";
    case "video/webm": return "webm";
    case "video/quicktime": return "mov";
    default:           return "bin";
  }
}

export async function saveToGallery(params: {
  userId: string;
  type: "image" | "video";
  modelId: string;
  modelLabel: string;
  prompt: string;
  sourceUrl: string;
  aspectRatio?: string;
}) {
  const response = await fetchWithRetry(params.sourceUrl);

  const rawMime = response.headers.get("content-type") ?? "";
  const mimeType = rawMime.split(";")[0].trim() || (params.type === "video" ? "video/mp4" : "image/jpeg");
  const ext = getExtFromMime(mimeType);
  const blobPath = `gallery/${params.userId}/${params.type}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await response.arrayBuffer());
  let persistedUrl = params.sourceUrl;
  try {
    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: mimeType,
    });
    persistedUrl = uploaded.url;
  } catch (error) {
    // If Blob store is configured as private, keep feature usable by falling
    // back to the source URL instead of failing the whole save action.
    if (!isPrivateStoreAccessError(error)) {
      throw error;
    }
  }

  return prisma.galleryItem.create({
    data: {
      userId: params.userId,
      type: params.type,
      modelId: params.modelId,
      modelLabel: params.modelLabel,
      prompt: params.prompt,
      blobUrl: persistedUrl,
      sourceUrl: params.sourceUrl,
      aspectRatio: params.aspectRatio ?? null,
      mimeType,
      isPublic: true,
    },
  });
}

export async function deleteGalleryItem(itemId: string, userId: string) {
  const item = await prisma.galleryItem.findUnique({ where: { id: itemId } });
  if (!item || item.userId !== userId) {
    throw new Error("Not found or unauthorized");
  }
  // Delete from Vercel Blob
  if (item.blobUrl !== item.sourceUrl) {
    try {
      await del(item.blobUrl);
    } catch {
      // Don't fail if blob deletion fails
    }
  }
  await prisma.galleryItem.delete({ where: { id: itemId } });
}
