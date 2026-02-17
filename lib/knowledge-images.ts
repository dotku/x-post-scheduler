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
    default:
      return "bin";
  }
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

    const mimeType = response.headers.get("content-type");
    if (!mimeType?.startsWith("image/")) {
      return { ok: false, error: "URL is not an image" };
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

  const uniqueImages = Array.from(
    new Map(params.images.map((image) => [image.url, image])).values()
  );

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
