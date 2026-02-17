import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet } from "@/lib/x-client";
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

  const credentials = await getUserXCredentials(user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: "X API credentials not configured. Please go to Settings." },
      { status: 400 }
    );
  }

  const result = await postTweet(post.content, credentials);

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
