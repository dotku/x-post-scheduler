import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getBlobToken } from "@/lib/blob-config";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[mimeType] || "bin";
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File must be under ${MAX_FILE_BYTES / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  const ext = getExtensionFromMime(file.type);
  const blobPath = `campaigns/${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const publicBlobToken = getBlobToken("public");

  try {
    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: publicBlobToken,
    });
    return NextResponse.json({
      url: uploaded.url,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });
  } catch (error) {
    // Fallback to private store when public access is not available
    try {
      const uploaded = await put(blobPath, buffer, {
        access: "private",
        addRandomSuffix: true,
        contentType: file.type,
      });
      return NextResponse.json({
        url: uploaded.url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
    } catch (fallbackError) {
      console.error("[campaigns/upload] Error:", fallbackError);
      return NextResponse.json(
        { error: fallbackError instanceof Error ? fallbackError.message : "Upload failed" },
        { status: 500 }
      );
    }
  }
}
