import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TwitterApi } from "twitter-api-v2";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get("oauth_token");
  const oauthVerifier = searchParams.get("oauth_verifier");

  const cookieStore = await cookies();
  const oauthTokenSecret = cookieStore.get("tw_oauth_secret")?.value;
  const storedOauthToken = cookieStore.get("tw_oauth_token")?.value;

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    (request.headers.get("origin") ?? "http://localhost:3000");

  if (
    !oauthToken ||
    !oauthVerifier ||
    !oauthTokenSecret ||
    oauthToken !== storedOauthToken
  ) {
    return NextResponse.redirect(`${baseUrl}/settings?error=oauth_failed`);
  }

  const appKey = (process.env.X_API_KEY || process.env.TWITTER_API_KEY)!;
  const appSecret = (process.env.X_API_SECRET || process.env.TWITTER_API_SECRET)!;

  try {
    const tempClient = new TwitterApi({
      appKey,
      appSecret,
      accessToken: oauthToken,
      accessSecret: oauthTokenSecret,
    });

    const { accessToken, accessSecret, screenName } =
      await tempClient.login(oauthVerifier);

    // Upsert account by username for this user
    const existing = await prisma.xAccount.findFirst({
      where: { userId: user.id, username: screenName },
    });

    const accountCount = await prisma.xAccount.count({
      where: { userId: user.id },
    });

    if (existing) {
      await prisma.xAccount.update({
        where: { id: existing.id },
        data: {
          xAccessToken: encrypt(accessToken),
          xAccessTokenSecret: encrypt(accessSecret),
          xApiKey: null,
          xApiSecret: null,
          username: screenName,
        },
      });
    } else {
      await prisma.xAccount.create({
        data: {
          userId: user.id,
          username: screenName,
          label: `@${screenName}`,
          xAccessToken: encrypt(accessToken),
          xAccessTokenSecret: encrypt(accessSecret),
          xApiKey: null,
          xApiSecret: null,
          isDefault: accountCount === 0,
        },
      });
    }

    // Clean up OAuth cookies
    cookieStore.delete("tw_oauth_secret");
    cookieStore.delete("tw_oauth_token");

    return NextResponse.redirect(`${baseUrl}/settings?connected=twitter`);
  } catch (err) {
    console.error("Twitter OAuth callback error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?error=oauth_failed`);
  }
}
