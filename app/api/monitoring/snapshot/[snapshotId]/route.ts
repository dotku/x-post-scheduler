import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public endpoint — no auth required. Fetches a snapshot by its publicId. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { snapshotId: publicId } = await params;

  const snapshot = await prisma.topicSnapshot.findUnique({
    where: { publicId },
    include: { topic: { select: { name: true, nameZh: true, description: true, keywords: true } } },
  });

  if (!snapshot) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({
    snapshot: {
      id: snapshot.id,
      tweetCount: snapshot.tweetCount,
      positiveCount: snapshot.positiveCount,
      negativeCount: snapshot.negativeCount,
      neutralCount: snapshot.neutralCount,
      avgScore: snapshot.avgScore,
      themes: snapshot.themes,
      topTweets: snapshot.topTweets,
      aiSummary: snapshot.aiSummary,
      modelId: snapshot.modelId,
      createdAt: snapshot.createdAt,
    },
    topic: snapshot.topic,
  });
}
