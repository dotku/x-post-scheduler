import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postTweet } from "@/lib/x-client";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";

export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const posts = await prisma.post.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

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

  if (postImmediately) {
    const credentials = await getUserXCredentials(user.id);
    if (!credentials) {
      return NextResponse.json(
        { error: "X API credentials not configured. Please go to Settings." },
        { status: 400 }
      );
    }

    const result = await postTweet(content, credentials);

    const post = await prisma.post.create({
      data: {
        content,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
        userId: user.id,
      },
    });

    return NextResponse.json(post);
  }

  const post = await prisma.post.create({
    data: {
      content,
      status: "scheduled",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      userId: user.id,
    },
  });

  return NextResponse.json(post);
}
