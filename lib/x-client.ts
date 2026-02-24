import { TwitterApi } from "twitter-api-v2";

export interface XCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken: string;
  accessTokenSecret: string;
}

function createXClient(credentials: XCredentials) {
  const appKey = credentials.apiKey || process.env.TWITTER_API_KEY;
  const appSecret = credentials.apiSecret || process.env.TWITTER_API_SECRET;
  if (!appKey || !appSecret) {
    throw new Error("Twitter app credentials are not configured");
  }
  return new TwitterApi({
    appKey,
    appSecret,
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

export interface TweetMedia {
  type: string;
  url: string | null;
}

export async function getTweetWithMedia(
  tweetId: string,
  credentials: XCredentials,
): Promise<{ mediaUrls: string[] }> {
  const client = createXClient(credentials);
  const response = await client.v2.singleTweet(tweetId, {
    expansions: ["attachments.media_keys"],
    "media.fields": ["url", "preview_image_url", "type"],
  });

  const mediaItems = response.includes?.media ?? [];
  const urls: string[] = [];
  for (const m of mediaItems) {
    const url =
      (m as { url?: string; preview_image_url?: string }).url ??
      (m as { url?: string; preview_image_url?: string }).preview_image_url;
    if (url) urls.push(url);
  }
  return { mediaUrls: urls };
}

export async function postTweet(
  content: string,
  credentials: XCredentials,
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
  credentials: XCredentials,
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
  credentials: XCredentials,
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

export interface TweetMetricsResult {
  tweetId: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
}

/**
 * Batch-fetch public metrics for up to 100 tweet IDs at once.
 * Returns a map of tweetId → metrics. Missing/failed tweets are omitted.
 */
export async function batchTweetMetrics(
  tweetIds: string[],
  credentials: XCredentials,
): Promise<Map<string, TweetMetricsResult>> {
  const result = new Map<string, TweetMetricsResult>();
  if (tweetIds.length === 0) return result;

  const client = createXClient(credentials);
  // Twitter API v2 supports up to 100 IDs per request
  const chunks: string[][] = [];
  for (let i = 0; i < tweetIds.length; i += 100) {
    chunks.push(tweetIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await client.v2.tweets(chunk, {
        "tweet.fields": ["public_metrics"],
      });
      const tweets = Array.isArray(response.data)
        ? response.data
        : response.data
          ? [response.data]
          : [];
      for (const tweet of tweets) {
        const m = tweet.public_metrics;
        result.set(tweet.id, {
          tweetId: tweet.id,
          impressions: m?.impression_count ?? 0,
          likes: m?.like_count ?? 0,
          retweets: m?.retweet_count ?? 0,
          replies: m?.reply_count ?? 0,
        });
      }
    } catch {
      // Silently skip failed chunks (rate limit, permissions, etc.)
    }
  }

  return result;
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

export interface UserProfileResult {
  username: string;
  followersCount: number;
  followingCount: number;
  tweetCount: number;
}

/**
 * Fetch current user profile including follower count.
 * Uses v1.1 verifyCredentials which is broadly available and always
 * includes follower/following/tweet counts without extra API scopes.
 */
export async function getUserProfile(
  credentials: XCredentials,
): Promise<UserProfileResult | null> {
  try {
    const client = createXClient(credentials);
    const me = await client.v1.verifyCredentials({ skip_status: true });

    return {
      username: me.screen_name ?? "",
      followersCount: me.followers_count ?? 0,
      followingCount: me.friends_count ?? 0,
      tweetCount: me.statuses_count ?? 0,
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}
