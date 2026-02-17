import { TwitterApi } from "twitter-api-v2";

export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function createXClient(credentials: XCredentials) {
  return new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessTokenSecret,
  });
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export interface TimelineTweet {
  id: string;
  text: string;
  createdAt: Date | null;
  impressionCount: number | null;
}

export async function postTweet(
  content: string,
  credentials: XCredentials
): Promise<PostResult> {
  try {
    const client = createXClient(credentials);
    const rwClient = client.readWrite;

    const result = await rwClient.v2.tweet(content);

    return {
      success: true,
      tweetId: result.data.id,
    };
  } catch (error) {
    console.error("Error posting tweet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function getRecentTweets(
  limit: number,
  excludeTweetIds: Set<string>,
  credentials: XCredentials
): Promise<TimelineTweet[]> {
  if (limit <= 0) return [];

  const client = createXClient(credentials);
  const me = await client.v2.me();
  const maxResults = Math.min(100, Math.max(5, limit));

  const paginator = await client.v2.userTimeline(me.data.id, {
    max_results: maxResults,
    exclude: ["replies", "retweets"],
    "tweet.fields": ["created_at", "public_metrics"],
  });

  const tweets = paginator.tweets ?? [];
  const results: TimelineTweet[] = [];

  for (const tweet of tweets) {
    if (excludeTweetIds.has(tweet.id)) continue;
    results.push({
      id: tweet.id,
      text: tweet.text ?? "",
      createdAt: tweet.created_at ? new Date(tweet.created_at) : null,
      impressionCount: tweet.public_metrics?.impression_count ?? null,
    });
    if (results.length >= limit) break;
  }

  return results;
}

export async function postTweetWithMedia(
  content: string,
  imageBuffer: Buffer,
  mimeType: string,
  credentials: XCredentials
): Promise<PostResult> {
  try {
    const client = createXClient(credentials);
    const rwClient = client.readWrite;

    // Upload media via v1 endpoint
    const mediaId = await rwClient.v1.uploadMedia(imageBuffer, {
      mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
    });

    // Post tweet with media
    const result = await rwClient.v2.tweet({
      text: content,
      media: { media_ids: [mediaId] },
    });

    return {
      success: true,
      tweetId: result.data.id,
    };
  } catch (error) {
    console.error("Error posting tweet with media:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function verifyCredentials(credentials: XCredentials): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const client = createXClient(credentials);
    const me = await client.v2.me();

    return {
      valid: true,
      username: me.data.username,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
