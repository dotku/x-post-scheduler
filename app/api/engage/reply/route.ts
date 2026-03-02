import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { postReply } from "@/lib/x-client";

// POST: Send a reply to a tweet (user-approved engagement action)
// Rate-limited to 10 replies per day per account
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { tweetId, content, xAccountId } = body;

  if (!tweetId || !content) {
    return NextResponse.json(
      { error: "tweetId and content are required" },
      { status: 400 },
    );
  }

  if (content.length > 280) {
    return NextResponse.json(
      { error: "Reply exceeds 280 characters" },
      { status: 400 },
    );
  }

  // Rate limit: max 10 replies per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayReplies = await prisma.post.count({
    where: {
      userId: user.id,
      postedAt: { gte: today },
      content: { startsWith: "@" },
    },
  });

  if (todayReplies >= 10) {
    return NextResponse.json(
      { error: "Daily reply limit reached (10/day). Try again tomorrow." },
      { status: 429 },
    );
  }

  const resolved = await getUserXCredentials(user.id, xAccountId);
  if (!resolved) {
    return NextResponse.json(
      { error: "X API credentials not configured." },
      { status: 400 },
    );
  }

  const result = await postReply(content, tweetId, resolved.credentials);

  // Record the reply as a post
  const post = await prisma.post.create({
    data: {
      content,
      status: result.success ? "posted" : "failed",
      postedAt: result.success ? new Date() : null,
      tweetId: result.tweetId || null,
      error: result.error || null,
      xAccountId: resolved.accountId,
      userId: user.id,
    },
  });

  return NextResponse.json(post);
}
