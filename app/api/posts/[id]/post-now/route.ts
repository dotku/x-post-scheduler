import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet } from "@/lib/x-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
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

  const result = await postTweet(post.content);

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
