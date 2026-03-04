import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getTeamWithRole, requireTeamRole, generateInviteCode } from "@/lib/team";

type Params = { params: Promise<{ teamId: string }> };

/** GET /api/team/[teamId] — get team details with members */
export async function GET(_request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  const result = await getTeamWithRole(teamId, user.id);
  if (!result) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      user: { select: { id: true, name: true, email: true, picture: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const invitations = await prisma.teamInvitation.findMany({
    where: { teamId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ...result.team,
    role: result.role,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      name: m.user.name,
      email: m.user.email,
      picture: m.user.picture,
    })),
    invitations,
  });
}

/** PATCH /api/team/[teamId] — update team name or regenerate invite code */
export async function PATCH(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  try {
    await requireTeamRole(teamId, user.id, "owner");
  } catch {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: { name?: string; inviteCode?: string } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) {
      return NextResponse.json(
        { error: "Team name is required (max 50 characters)" },
        { status: 400 },
      );
    }
    updateData.name = name;
  }

  if (body.regenerateInviteCode) {
    updateData.inviteCode = generateInviteCode();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: updateData,
  });

  return NextResponse.json(team);
}

/** DELETE /api/team/[teamId] — delete the team (owner only) */
export async function DELETE(_request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  try {
    await requireTeamRole(teamId, user.id, "owner");
  } catch {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ success: true });
}
