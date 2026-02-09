import { TwitterApi } from "twitter-api-v2";

// Create the X API client with OAuth 1.0a credentials
function getXClient() {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error(
      "Missing X API credentials. Please set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, and X_ACCESS_TOKEN_SECRET in .env.local"
    );
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

// Post a tweet to X
export async function postTweet(content: string): Promise<PostResult> {
  try {
    const client = getXClient();
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

// Verify credentials are valid
export async function verifyCredentials(): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const client = getXClient();
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
