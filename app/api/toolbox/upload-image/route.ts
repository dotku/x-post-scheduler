import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";
import {
  getBlobToken,
  isLocalhost,
  checkBlobPublicAccess,
} from "@/lib/blob-config";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

function isPrivateStoreAccessError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("private store") && message.includes("public access");
}

function getExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    default:
      return "bin";
  }
}

function resolvePublicOrigin(requestOrigin: string) {
  // For external provider access (Wavespeed), MUST use NEXT_PUBLIC_APP_PUBLIC_URL (public domain)
  // Never use localhost, as external APIs cannot reach it
  const configured =
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
    process.env.APP_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const origin = configured.trim() || requestOrigin;
  const isLocal =
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("0.0.0.0");
  return { origin, isLocal };
}

function getPublicBlobReadWriteToken() {
  return getBlobToken("public");
}

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Only image files are supported" },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `Image must be between 1 byte and ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`,
      },
      { status: 400 },
    );
  }

  const ext = getExtensionFromMime(file.type);
  const blobPath = `toolbox-inputs/${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicBlobToken = getPublicBlobReadWriteToken();

  try {
    // Upload with public access for external provider access
    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: publicBlobToken,
    });
    // Use NEXT_PUBLIC_APP_PUBLIC_URL for external provider access
    const publicUrl = uploaded.url;
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    if (isPrivateStoreAccessError(error)) {
      try {
        const uploadedPrivate = await put(blobPath, buffer, {
          access: "private",
          addRandomSuffix: true,
          contentType: file.type,
        });
        const { origin, isLocal } = resolvePublicOrigin(request.nextUrl.origin);
        if (isLocal) {
          const diagnostics = checkBlobPublicAccess();
          return NextResponse.json(
            {
              error:
                "Cannot upload for external provider access on localhost. " +
                "Blob store is private and localhost proxy is unreachable by external APIs like Wavespeed. " +
                (diagnostics.diagnostics.recommendations?.[0]
                  ? "Recommendation: " +
                    diagnostics.diagnostics.recommendations[0]
                  : "Deploy to production for public blob access."),
            },
            { status: 400 },
          );
        }
        const proxyUrl = buildSignedBlobProxyUrl(origin, uploadedPrivate.url);
        return NextResponse.json({ url: proxyUrl });
      } catch (privateError) {
        return NextResponse.json(
          {
            error:
              privateError instanceof Error
                ? privateError.message
                : "Failed to upload private image",
          },
          { status: 500 },
        );
      }
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 },
    );
  }
}
