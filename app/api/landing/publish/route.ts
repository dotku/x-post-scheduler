import { NextRequest, NextResponse } from "next/server";
import { TwitterApi } from "twitter-api-v2";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { content, xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret } =
    body;

  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (!xApiKey || !xApiSecret || !xAccessToken || !xAccessTokenSecret) {
    return NextResponse.json(
      { error: "All four X API credentials are required" },
      { status: 400 },
    );
  }

  // NOTE: credentials are used only for this request and are NOT stored in the database.
  try {
    const client = new TwitterApi({
      appKey: xApiKey,
      appSecret: xApiSecret,
      accessToken: xAccessToken,
      accessSecret: xAccessTokenSecret,
    });

    const result = await client.v2.tweet(content);
    const tweetId = result.data.id;
    const tweetUrl = `https://x.com/i/web/status/${tweetId}`;

    return NextResponse.json({ success: true, tweetId, tweetUrl });
  } catch (err: unknown) {
    console.error("X publish error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to publish to X";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
