import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet } from "@/lib/x-client";

export async function GET() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content, scheduledAt, postImmediately } = body;

  if (!content || content.length === 0) {
    return NextResponse.json(
      { error: "Content is required" },
      { status: 400 }
    );
  }

  if (content.length > 280) {
    return NextResponse.json(
      { error: "Content exceeds 280 characters" },
      { status: 400 }
    );
  }

  // If posting immediately
  if (postImmediately) {
    const result = await postTweet(content);

    const post = await prisma.post.create({
      data: {
        content,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
      },
    });

    return NextResponse.json(post);
  }

  // Schedule for later
  const post = await prisma.post.create({
    data: {
      content,
      status: "scheduled",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  return NextResponse.json(post);
}
