import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet, postTweetWithMedia } from "@/lib/x-client";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";

export async function POST(
  request: NextRequest,
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

  if (post.status === "posted") {
    return NextResponse.json(
      { error: "Post has already been published" },
      { status: 400 }
    );
  }

  const resolved = await getUserXCredentials(user.id, post.xAccountId);
  if (!resolved) {
    return NextResponse.json(
      { error: "X API credentials not configured. Please go to Settings." },
      { status: 400 }
    );
  }

  // Parse mediaUrls JSON field (e.g., ["https://..."])
  let mediaUrlList: string[] = [];
  if (post.mediaUrls) {
    try {
      const parsed = JSON.parse(post.mediaUrls);
      if (Array.isArray(parsed)) mediaUrlList = parsed;
    } catch {
      // ignore malformed JSON
    }
  }

  let result;
  if (mediaUrlList.length > 0) {
    const mediaRes = await fetch(mediaUrlList[0]);
    if (!mediaRes.ok) {
      return NextResponse.json({ error: "Failed to fetch media" }, { status: 400 });
    }
    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    const mimeType = (mediaRes.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    result = await postTweetWithMedia(post.content, buffer, mimeType, resolved.credentials);
  } else {
    result = await postTweet(post.content, resolved.credentials);
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      status: result.success ? "posted" : "failed",
      postedAt: result.success ? new Date() : null,
      tweetId: result.tweetId || null,
      error: result.error || null,
    },
  });

  return NextResponse.json(updatedPost);
}
