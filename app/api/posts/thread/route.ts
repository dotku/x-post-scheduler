import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";
import { generateThread } from "@/lib/thread-generator";
import { getContentProfile } from "@/lib/content-profile";
import { getUserXCredentials } from "@/lib/user-credentials";
import { postTweet, postReply } from "@/lib/x-client";

// POST: Generate and optionally post a thread
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  if (!(await hasCredits(user.id))) {
    return NextResponse.json(
      { error: "Insufficient credits for thread generation." },
      { status: 402 },
    );
  }

  const body = await request.json();
  const { prompt, language, count, postImmediately, xAccountId } = body;

  // Load knowledge sources, content profile, and recent posts
  const [sources, recentPostsRows, profileData] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { isActive: true, userId: user.id },
    }),
    prisma.post.findMany({
      where: { userId: user.id, status: "posted" },
      orderBy: { postedAt: "desc" },
      take: 5,
      select: { content: true },
    }),
    getContentProfile(user.id),
  ]);

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No knowledge sources found. Please add at least one website." },
      { status: 400 },
    );
  }

  const knowledgeContext = sources
    .map((source) => {
      const truncated =
        source.content.length > 2000
          ? source.content.substring(0, 2000) + "..."
          : source.content;
      return `Source: ${source.name} (${source.url})\n${truncated}`;
    })
    .join("\n\n---\n\n");

  const result = await generateThread({
    knowledgeContext,
    prompt,
    language,
    contentProfile: profileData.profile ?? undefined,
    recentPosts: recentPostsRows.map((p) => p.content),
    count,
  });

  // Track usage
  if (result.usage) {
    try {
      await trackTokenUsage({
        userId: user.id,
        source: "thread_generation",
        usage: result.usage,
        model: result.model,
      });
      await deductCredits({
        userId: user.id,
        usage: result.usage,
        model: result.model,
        source: "thread_generation",
      });
    } catch (error) {
      console.error("Failed to track/deduct thread generation credits:", error);
    }
  }

  if (!result.success || !result.tweets) {
    return NextResponse.json(
      { error: result.error || "Thread generation failed" },
      { status: 500 },
    );
  }

  // Create a thread group ID
  const threadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (postImmediately) {
    const resolved = await getUserXCredentials(user.id, xAccountId);
    if (!resolved) {
      return NextResponse.json(
        { error: "X API credentials not configured." },
        { status: 400 },
      );
    }

    // Post the thread: first tweet, then replies
    const postedPosts = [];
    let previousTweetId: string | null = null;

    for (let i = 0; i < result.tweets.length; i++) {
      const tweetContent = result.tweets[i];
      let postResult;

      if (i === 0) {
        postResult = await postTweet(tweetContent, resolved.credentials);
      } else {
        postResult = await postReply(
          tweetContent,
          previousTweetId!,
          resolved.credentials,
        );
      }

      const post = await prisma.post.create({
        data: {
          content: tweetContent,
          status: postResult.success ? "posted" : "failed",
          postedAt: postResult.success ? new Date() : null,
          tweetId: postResult.tweetId || null,
          error: postResult.error || null,
          threadId,
          threadOrder: i,
          xAccountId: resolved.accountId,
          userId: user.id,
        },
      });

      postedPosts.push(post);

      if (postResult.success && postResult.tweetId) {
        previousTweetId = postResult.tweetId;
      } else {
        // Stop thread if a tweet fails
        break;
      }
    }

    return NextResponse.json({ threadId, posts: postedPosts });
  }

  // Save as scheduled/draft posts
  const savedPosts = await Promise.all(
    result.tweets.map((tweet, i) =>
      prisma.post.create({
        data: {
          content: tweet,
          status: "draft",
          threadId,
          threadOrder: i,
          userId: user.id,
        },
      }),
    ),
  );

  return NextResponse.json({
    threadId,
    tweets: result.tweets,
    posts: savedPosts,
  });
}
