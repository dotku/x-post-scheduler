import { prisma } from "./db";
import { getOpenAIClient } from "./openai";
import type { TokenUsage } from "./usage-tracking";

export interface ContentProfileResult {
  success: boolean;
  profile?: string;
  usage?: TokenUsage;
  model?: string;
  error?: string;
  postCount?: number;
  topPostCount?: number;
}

const MINIMUM_POSTS_FOR_PROFILE = 10;
const PROFILE_STALE_DAYS = 7;

/**
 * Check whether the user's content profile is stale (older than 7 days)
 * or has never been generated.
 */
export async function isProfileStale(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { contentProfileUpdatedAt: true },
  });
  if (!user?.contentProfileUpdatedAt) return true;
  const ageMs = Date.now() - user.contentProfileUpdatedAt.getTime();
  return ageMs > PROFILE_STALE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Load the user's current content profile text, or null if none exists.
 */
export async function getContentProfile(userId: string): Promise<{
  profile: string | null;
  updatedAt: Date | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { contentProfile: true, contentProfileUpdatedAt: true },
  });
  return {
    profile: user?.contentProfile ?? null,
    updatedAt: user?.contentProfileUpdatedAt ?? null,
  };
}

/**
 * Analyze user's posted tweets and generate a content profile via GPT-4o.
 * Requires at least MINIMUM_POSTS_FOR_PROFILE posted tweets with metrics.
 */
export async function generateContentProfile(
  userId: string,
): Promise<ContentProfileResult> {
  // 1. Fetch posted tweets that have metrics
  const posts = await prisma.post.findMany({
    where: {
      userId,
      status: "posted",
      impressions: { not: null, gt: 0 },
    },
    select: {
      content: true,
      impressions: true,
      likes: true,
      retweets: true,
      replies: true,
      postedAt: true,
    },
    orderBy: { postedAt: "desc" },
    take: 100,
  });

  if (posts.length < MINIMUM_POSTS_FOR_PROFILE) {
    return {
      success: false,
      error: `Need at least ${MINIMUM_POSTS_FOR_PROFILE} posted tweets with metrics. Currently have ${posts.length}.`,
      postCount: posts.length,
    };
  }

  // 2. Calculate engagement rate for each post
  const scoredPosts = posts.map((p) => {
    const impressions = p.impressions ?? 0;
    const likes = p.likes ?? 0;
    const retweets = p.retweets ?? 0;
    const replies = p.replies ?? 0;
    const engagements = likes + retweets + replies;
    const engagementRate =
      impressions > 0 ? (engagements / impressions) * 100 : 0;
    return { ...p, engagementRate, engagements };
  });

  // 3. Sort by engagement rate, pick top 25% vs rest
  scoredPosts.sort((a, b) => b.engagementRate - a.engagementRate);
  const topCount = Math.max(3, Math.floor(scoredPosts.length * 0.25));
  const topPosts = scoredPosts.slice(0, topCount);
  const averagePosts = scoredPosts.slice(topCount);

  // 4. Build analysis prompt
  const topPostsText = topPosts
    .map(
      (p, i) =>
        `${i + 1}. [Engagement: ${p.engagementRate.toFixed(2)}%, ${p.engagements} engagements, ${p.impressions} impressions]\n"${p.content}"`,
    )
    .join("\n\n");

  const avgPostsText = averagePosts
    .slice(0, 15)
    .map(
      (p, i) =>
        `${i + 1}. [Engagement: ${p.engagementRate.toFixed(2)}%, ${p.engagements} engagements, ${p.impressions} impressions]\n"${p.content}"`,
    )
    .join("\n\n");

  const avgEngagement =
    scoredPosts.reduce((sum, p) => sum + p.engagementRate, 0) /
    scoredPosts.length;
  const topAvgEngagement =
    topPosts.reduce((sum, p) => sum + p.engagementRate, 0) / topPosts.length;

  const systemPrompt = `You are a social media analytics expert. Analyze the user's tweet performance data and create a content profile that identifies what makes their top-performing tweets succeed.

Your analysis should be structured, actionable, and specific to THIS user's data. Focus on patterns you can observe.`;

  const userPrompt = `Here is my tweet performance data:

## Summary
- Total analyzed posts: ${scoredPosts.length}
- Average engagement rate: ${avgEngagement.toFixed(2)}%
- Top posts average engagement rate: ${topAvgEngagement.toFixed(2)}%

## Top-performing posts (top 25% by engagement rate):
${topPostsText}

## Average-performing posts (sample):
${avgPostsText}

Based on this data, create a content profile. Structure it as:

1. **Winning Topics/Themes**: What topics get the most engagement?
2. **Best Hook Styles**: How do the top posts open? (question, bold claim, stat, story, etc.)
3. **Optimal Tone & Voice**: Is it casual, authoritative, humorous, provocative?
4. **Format Patterns**: Length, use of hashtags, emojis, line breaks, lists
5. **What to Avoid**: Patterns from low-performing posts
6. **Key Insight**: One sentence summarizing what makes this account's content resonate

Keep the profile concise (under 500 words). Write it as direct instructions for a content writer.`;

  // 5. Call GPT-4o
  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.4,
    });

    const profile = response.choices[0]?.message?.content?.trim();
    const usage: TokenUsage | undefined = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens ?? 0,
          completionTokens: response.usage.completion_tokens ?? 0,
          totalTokens: response.usage.total_tokens ?? 0,
        }
      : undefined;

    if (!profile) {
      return { success: false, error: "No profile generated", usage };
    }

    // 6. Save to User model
    await prisma.user.update({
      where: { id: userId },
      data: {
        contentProfile: profile,
        contentProfileUpdatedAt: new Date(),
      },
    });

    return {
      success: true,
      profile,
      usage,
      model: response.model,
      postCount: scoredPosts.length,
      topPostCount: topCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
