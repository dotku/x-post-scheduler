import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTweetWithMedia } from "@/lib/x-client";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  const post = await prisma.post.findFirst({
    where: { id, userId: user.id },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!post.tweetId) {
    return NextResponse.json({ error: "Post has no tweetId" }, { status: 400 });
  }

  const credentials = await getUserXCredentials(user.id);
  if (!credentials) {
    return NextResponse.json({ error: "X credentials not configured" }, { status: 400 });
  }

  let result;
  try {
    result = await getTweetWithMedia(post.tweetId, credentials.credentials);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("getTweetWithMedia error:", err);
    return NextResponse.json({ error: `X API error: ${detail}` }, { status: 500 });
  }

  if (!result || result.mediaUrls.length === 0) {
    return NextResponse.json({ error: "No media found on this tweet" }, { status: 404 });
  }

  const updated = await prisma.post.update({
    where: { id },
    data: { mediaUrls: JSON.stringify(result.mediaUrls) },
  });

  return NextResponse.json({ mediaUrls: result.mediaUrls, post: updated });
}
