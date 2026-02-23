import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { userId: followingId } = await params;

  if (followingId === user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: followingId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.userFollow.findUnique({
    where: { followerId_followingId: { followerId: user.id, followingId } },
  });

  if (existing) {
    await prisma.userFollow.delete({
      where: { followerId_followingId: { followerId: user.id, followingId } },
    });
  } else {
    await prisma.userFollow.create({
      data: { followerId: user.id, followingId },
    });
  }

  const count = await prisma.userFollow.count({ where: { followingId } });
  return NextResponse.json({ following: !existing, count });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: followingId } = await params;

  let currentUserId: string | null = null;
  try {
    const user = await requireAuth();
    currentUserId = user.id;
  } catch {
    // unauthenticated — return count only
  }

  const [count, isFollowing] = await Promise.all([
    prisma.userFollow.count({ where: { followingId } }),
    currentUserId
      ? prisma.userFollow.findUnique({
          where: { followerId_followingId: { followerId: currentUserId, followingId } },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ count, following: !!isFollowing });
}
