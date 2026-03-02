import { put } from "@vercel/blob";
import { prisma } from "./db";
import { ScrapedImage } from "./scraper";

function getExtensionFromMime(mimeType: string | null): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "audio/mpeg":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    default:
      return "bin";
  }
}

function isAllowedMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/")
  );
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "item";
}

async function uploadOneImageToBlob(params: {
  userId: string;
  knowledgeSourceId: string;
  sourceImage: ScrapedImage;
  index: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(params.sourceImage.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; XPostScheduler/1.0; +https://example.com)",
      },
    });

    if (!response.ok) {
      return { ok: false, error: `Failed to fetch image (${response.status})` };
    }

    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!isAllowedMimeType(mimeType)) {
      return { ok: false, error: `Unsupported media type: ${mimeType}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = getExtensionFromMime(mimeType);
    const blobPath = `knowledge/${safeSegment(params.userId)}/${safeSegment(
      params.knowledgeSourceId
    )}/${Date.now()}-${params.index}.${ext}`;

    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: mimeType,
    });

    await prisma.knowledgeImage.upsert({
      where: {
        knowledgeSourceId_sourceUrl: {
          knowledgeSourceId: params.knowledgeSourceId,
          sourceUrl: params.sourceImage.url,
        },
      },
      update: {
        blobUrl: uploaded.url,
        mimeType,
        altText: params.sourceImage.altText ?? null,
      },
      create: {
        userId: params.userId,
        knowledgeSourceId: params.knowledgeSourceId,
        sourceUrl: params.sourceImage.url,
        blobUrl: uploaded.url,
        mimeType,
        altText: params.sourceImage.altText ?? null,
      },
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

export async function uploadBase64ToBlob(params: {
  userId: string;
  knowledgeSourceId: string;
  sourceUrl: string;
  base64Data: string; // data:image/jpeg;base64,...
  altText?: string;
  mediaType: string; // "thumbnail" | "video"
  duration?: number;
}): Promise<{ ok: boolean; blobUrl?: string; error?: string }> {
  try {
    const match = params.base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { ok: false, error: "Invalid base64 data URI" };

    const [, mimeType, base64] = match;
    const buffer = Buffer.from(base64, "base64");
    const ext = getExtensionFromMime(mimeType);
    const blobPath = `knowledge/${safeSegment(params.userId)}/${safeSegment(
      params.knowledgeSourceId
    )}/${Date.now()}-${params.mediaType}.${ext}`;

    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: mimeType,
    });

    await prisma.knowledgeImage.upsert({
      where: {
        knowledgeSourceId_sourceUrl: {
          knowledgeSourceId: params.knowledgeSourceId,
          sourceUrl: params.sourceUrl,
        },
      },
      update: {
        blobUrl: uploaded.url,
        mimeType,
        altText: params.altText ?? null,
        mediaType: params.mediaType,
        duration: params.duration ?? null,
      },
      create: {
        userId: params.userId,
        knowledgeSourceId: params.knowledgeSourceId,
        sourceUrl: params.sourceUrl,
        blobUrl: uploaded.url,
        mimeType,
        altText: params.altText ?? null,
        mediaType: params.mediaType,
        duration: params.duration ?? null,
      },
    });

    return { ok: true, blobUrl: uploaded.url };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
    };
  }
}

export async function syncKnowledgeSourceThumbnails(params: {
  userId: string;
  knowledgeSourceId: string;
  thumbnails: Array<{ url: string; base64Data: string; altText?: string }>;
}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { uploaded: 0, failed: params.thumbnails.length, skipped: true };
  }

  let uploaded = 0;
  const errors: string[] = [];

  for (const thumb of params.thumbnails) {
    const result = await uploadBase64ToBlob({
      userId: params.userId,
      knowledgeSourceId: params.knowledgeSourceId,
      sourceUrl: thumb.url,
      base64Data: thumb.base64Data,
      altText: thumb.altText,
      mediaType: "thumbnail",
    });
    if (result.ok) {
      uploaded += 1;
    } else if (result.error) {
      errors.push(`${thumb.url} - ${result.error}`);
    }
  }

  return { uploaded, failed: params.thumbnails.length - uploaded, errors, skipped: false };
}

export async function syncKnowledgeSourceImages(params: {
  userId: string;
  knowledgeSourceId: string;
  images: ScrapedImage[];
}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      uploaded: 0,
      failed: params.images.length,
      errors: ["Missing BLOB_READ_WRITE_TOKEN"],
      skipped: true,
    };
  }

  const maxImages = Number.parseInt(process.env.SCRAPER_MAX_IMAGES || "120", 10);
  const uniqueImages = Array.from(
    new Map(params.images.map((image) => [image.url, image])).values()
  ).slice(0, Number.isFinite(maxImages) && maxImages > 0 ? maxImages : 120);

  const errors: string[] = [];
  let uploaded = 0;
  let index = 0;
  for (const image of uniqueImages) {
    const result = await uploadOneImageToBlob({
      userId: params.userId,
      knowledgeSourceId: params.knowledgeSourceId,
      sourceImage: image,
      index,
    });
    index += 1;
    if (result.ok) {
      uploaded += 1;
    } else if (result.error) {
      errors.push(`${image.url} - ${result.error}`);
    }
  }

  await prisma.knowledgeImage.deleteMany({
    where: {
      knowledgeSourceId: params.knowledgeSourceId,
      mediaType: "image",
      sourceUrl: {
        notIn: uniqueImages.map((img) => img.url),
      },
    },
  });

  return {
    uploaded,
    failed: uniqueImages.length - uploaded,
    errors,
    skipped: false,
  };
}
