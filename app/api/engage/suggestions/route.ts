import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { getOpenAIClient } from "@/lib/openai";
import { getRecentTweetsWithMetrics } from "@/lib/x-client";

// GET: Return AI-generated engagement suggestions
// Finds recent replies to user's own posts and suggests responses
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const resolved = await getUserXCredentials(user.id);
  if (!resolved) {
    return NextResponse.json(
      { error: "X API credentials not configured." },
      { status: 400 },
    );
  }

  // Get user's recent posted tweets with high engagement
  const recentTweets = await getRecentTweetsWithMetrics(
    20,
    resolved.credentials,
  );

  // Find tweets with replies > 0 (engagement opportunities)
  const tweetsWithReplies = recentTweets
    .filter((t) => t.replies > 0)
    .sort((a, b) => b.replies - a.replies)
    .slice(0, 5);

  if (tweetsWithReplies.length === 0) {
    return NextResponse.json({
      suggestions: [],
      message: "No tweets with replies found. Keep posting to build engagement!",
    });
  }

  // Check today's reply count to enforce rate limit
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayReplies = await prisma.post.count({
    where: {
      userId: user.id,
      postedAt: { gte: today },
      content: { startsWith: "@" },
    },
  });

  const remainingReplies = Math.max(0, 10 - todayReplies);

  // Generate suggested engagement actions
  const client = getOpenAIClient();
  const suggestions = [];

  for (const tweet of tweetsWithReplies.slice(0, 3)) {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are helping a user engage with their audience on X (Twitter).
Generate a brief, thoughtful follow-up reply the user could post to their own tweet to boost engagement.
The reply should: invite further discussion, add a new angle, or ask a follow-up question.
Keep it under 280 characters. Be conversational and authentic.`,
          },
          {
            role: "user",
            content: `My tweet: "${tweet.text}"
This tweet got ${tweet.replies} replies, ${tweet.likes} likes, ${tweet.retweets} retweets.
Suggest a follow-up reply I can post to keep the conversation going:`,
          },
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const suggestion = response.choices[0]?.message?.content?.trim();
      if (suggestion) {
        suggestions.push({
          tweetId: tweet.id,
          originalTweet: tweet.text,
          metrics: {
            replies: tweet.replies,
            likes: tweet.likes,
            retweets: tweet.retweets,
            impressions: tweet.impressions,
          },
          suggestedReply: suggestion,
        });
      }
    } catch (error) {
      console.error(`Failed to generate suggestion for tweet ${tweet.id}:`, error);
    }
  }

  return NextResponse.json({
    suggestions,
    remainingReplies,
    dailyLimit: 10,
  });
}
