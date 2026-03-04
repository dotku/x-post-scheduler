import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserTeams, generateInviteCode } from "@/lib/team";

/** GET /api/team — list all teams the user belongs to */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const teams = await getUserTeams(user.id);

  // Also fetch pending invitations for the user's email
  const pendingInvites = user.email
    ? await prisma.teamInvitation.findMany({
        where: { email: user.email, status: "pending" },
        include: { team: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return NextResponse.json({ teams, pendingInvites });
}

/** POST /api/team — create a new team */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 50) {
    return NextResponse.json(
      { error: "Team name is required (max 50 characters)" },
      { status: 400 },
    );
  }

  const team = await prisma.team.create({
    data: {
      name,
      inviteCode: generateInviteCode(),
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, picture: true } } },
      },
    },
  });

  return NextResponse.json(team, { status: 201 });
}
