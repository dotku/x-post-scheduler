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
  const { content, scheduledAt, postImmediately, mediaAssetId, xAccountId } =
    body;

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
    const resolved = await getUserXCredentials(user.id, xAccountId);
    if (!resolved) {
      return NextResponse.json(
        { error: "X API credentials not configured. Please go to Settings." },
        { status: 400 }
      );
    }

    const result = await postTweet(content, resolved.credentials);

    const post = await prisma.post.create({
      data: {
        content,
        status: result.success ? "posted" : "failed",
        postedAt: result.success ? new Date() : null,
        tweetId: result.tweetId || null,
        error: result.error || null,
        mediaAssetId: typeof mediaAssetId === "string" ? mediaAssetId : null,
        xAccountId: resolved.accountId,
        userId: user.id,
      },
    });

    return NextResponse.json(post);
  }

  const resolvedForSchedule = await getUserXCredentials(user.id, xAccountId);
  if (!resolvedForSchedule) {
    return NextResponse.json(
      { error: "Please select a valid connected X account." },
      { status: 400 }
    );
  }

  const post = await prisma.post.create({
    data: {
      content,
      status: "scheduled",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      mediaAssetId: typeof mediaAssetId === "string" ? mediaAssetId : null,
      xAccountId: resolvedForSchedule.accountId,
      userId: user.id,
    },
  });

  return NextResponse.json(post);
}
