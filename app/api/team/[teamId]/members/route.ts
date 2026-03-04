import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { requireTeamRole } from "@/lib/team";

type Params = { params: Promise<{ teamId: string }> };

/** GET /api/team/[teamId]/members — list members */
export async function GET(_request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  try {
    await requireTeamRole(teamId, user.id, "viewer");
  } catch {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true, picture: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      name: m.user.name,
      email: m.user.email,
      picture: m.user.picture,
    })),
  );
}
