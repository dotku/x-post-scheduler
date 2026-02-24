import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TwitterApi } from "twitter-api-v2";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function GET(request: Request) {
  try {
    await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  if (!appKey || !appSecret) {
    return NextResponse.json(
      { error: "Twitter app credentials are not configured" },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (request.headers.get("origin") ?? "http://localhost:3000");
  const callbackUrl = `${baseUrl}/api/auth/twitter/callback`;

  try {
    const client = new TwitterApi({ appKey, appSecret });
    const { url, oauth_token, oauth_token_secret } =
      await client.generateAuthLink(callbackUrl, { linkMode: "authorize" });

    // Store oauth_token_secret in a short-lived httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("tw_oauth_secret", oauth_token_secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 900, // 15 minutes
      sameSite: "lax",
      path: "/",
    });
    cookieStore.set("tw_oauth_token", oauth_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 900,
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.redirect(url);
  } catch (err) {
    console.error("Twitter OAuth connect error:", err);
    return NextResponse.json(
      { error: "Failed to initiate Twitter OAuth" },
      { status: 500 }
    );
  }
}
