import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";

/** DELETE — revoke an API key */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { keyId } = await params;

  const result = await prisma.apiKey.updateMany({
    where: { id: keyId, userId: user.id, isRevoked: false },
    data: { isRevoked: true },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "API key not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
