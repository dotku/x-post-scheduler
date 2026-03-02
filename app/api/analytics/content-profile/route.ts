import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";
import {
  generateContentProfile,
  getContentProfile,
} from "@/lib/content-profile";

// GET: Retrieve current content profile
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { profile, updatedAt } = await getContentProfile(user.id);

  return NextResponse.json({ profile, updatedAt });
}

// POST: Generate or refresh the content profile
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  if (!(await hasCredits(user.id))) {
    return NextResponse.json(
      { error: "Insufficient credits for content profile generation." },
      { status: 402 },
    );
  }

  const result = await generateContentProfile(user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, postCount: result.postCount },
      { status: 400 },
    );
  }

  // Track usage and deduct credits
  if (result.usage) {
    try {
      await trackTokenUsage({
        userId: user.id,
        source: "content_profile_generation",
        usage: result.usage,
        model: result.model,
      });
      await deductCredits({
        userId: user.id,
        usage: result.usage,
        model: result.model,
        source: "content_profile_generation",
      });
    } catch (error) {
      console.error("Failed to track/deduct content profile credits:", error);
    }
  }

  return NextResponse.json({
    profile: result.profile,
    postCount: result.postCount,
    topPostCount: result.topPostCount,
  });
}
