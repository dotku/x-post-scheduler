import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getBlobToken } from "@/lib/blob-config";

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

const ALLOWED_VIDEO_TYPES: Record<string, string> = {
  "video/mp4":       "mp4",
  "video/webm":      "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
  "video/mpeg":      "mpeg",
};

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
    return NextResponse.json({ error: "Missing video file" }, { status: 400 });
  }

  const ext = ALLOWED_VIDEO_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported format. Allowed: mp4, webm, mov, avi, mpeg" },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: `Video must be between 1 byte and ${MAX_VIDEO_BYTES / (1024 * 1024)}MB` },
      { status: 400 },
    );
  }

  const blobPath = `toolbox-videos/${user.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const uploaded = await put(blobPath, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
      token: getBlobToken("public"),
    });
    return NextResponse.json({
      url: uploaded.url,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    console.error("Video upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
