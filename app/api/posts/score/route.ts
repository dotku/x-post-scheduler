import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { scoreTweetCandidates } from "@/lib/ab-scoring";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length < 10) {
    return NextResponse.json(
      { error: "Content must be at least 10 characters" },
      { status: 400 },
    );
  }

  // Fetch user's content profile for personalized scoring
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { contentProfile: true },
  });

  const result = await scoreTweetCandidates(
    [content],
    dbUser?.contentProfile ?? undefined,
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Scoring failed" },
      { status: 500 },
    );
  }

  const scored = result.candidates?.[0];
  return NextResponse.json({
    score: scored?.score ?? 50,
    reasoning: scored?.reasoning ?? "",
  });
}
