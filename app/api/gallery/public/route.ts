import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth0";

type RawItem = Record<string, unknown> & {
  id: string;
  _count?: { likes: number; comments: number };
};

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = 48;

  // Optionally identify current user for "liked" state
  let currentUserId: string | null = null;
  try {
    const user = await requireAuth();
    currentUserId = user.id;
  } catch {
    // unauthenticated — that's fine
  }

  // Try with _count (social counts); fall back to plain query if new relations
  // aren't available in this process yet (restart dev server to update client).
  let page: RawItem[] = [];
  let nextCursor: string | null = null;

  try {
    const items = await prisma.galleryItem.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, picture: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    const hasMore = items.length > limit;
    page = (hasMore ? items.slice(0, limit) : items) as RawItem[];
    nextCursor = hasMore ? page[page.length - 1].id : null;
  } catch {
    // Fallback: _count relations not available in the current Prisma client instance.
    // This happens if the dev server hasn't been restarted after a schema migration.
    const items = await prisma.galleryItem.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: { select: { id: true, name: true, picture: true } },
      },
    });
    const hasMore = items.length > limit;
    page = (hasMore ? items.slice(0, limit) : items) as RawItem[];
    nextCursor = hasMore ? page[page.length - 1].id : null;
  }

  // Batch-check which items the current user liked
  let likedSet = new Set<string>();
  if (currentUserId && page.length > 0) {
    try {
      const itemIds = page.map((i) => i.id);
      const liked = await prisma.galleryLike.findMany({
        where: { userId: currentUserId, itemId: { in: itemIds } },
        select: { itemId: true },
      });
      likedSet = new Set(liked.map((l) => l.itemId));
    } catch {
      // galleryLike delegate not yet available — skip liked state
    }
  }

  const enriched = page.map((item) => {
    const { _count, ...rest } = item;
    return {
      ...rest,
      likeCount: (_count as { likes?: number } | undefined)?.likes ?? 0,
      commentCount: (_count as { comments?: number } | undefined)?.comments ?? 0,
      currentUserLiked: likedSet.has(item.id),
    };
  });

  return NextResponse.json({ items: enriched, nextCursor });
}
