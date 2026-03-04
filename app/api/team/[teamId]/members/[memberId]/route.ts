import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { requireTeamRole, isRoleAtLeast } from "@/lib/team";
import type { TeamRole } from "@/lib/team";

type Params = { params: Promise<{ teamId: string; memberId: string }> };

/** PATCH /api/team/[teamId]/members/[memberId] — change member role */
export async function PATCH(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId, memberId } = await params;
  try {
    await requireTeamRole(teamId, user.id, "owner");
  } catch {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const body = await request.json();
  const newRole = body.role as string;
  const validRoles: TeamRole[] = ["viewer", "editor", "owner"];
  if (!validRoles.includes(newRole as TeamRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!target || target.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot change own role
  if (target.userId === user.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role: newRole },
  });

  return NextResponse.json(updated);
}

/** DELETE /api/team/[teamId]/members/[memberId] — remove member */
export async function DELETE(_request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId, memberId } = await params;

  const target = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!target || target.teamId !== teamId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Members can remove themselves (leave team)
  if (target.userId === user.id) {
    if (target.role === "owner") {
      // Check if there's another owner
      const otherOwners = await prisma.teamMember.count({
        where: { teamId, role: "owner", id: { not: memberId } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { error: "Cannot leave: you are the only owner. Transfer ownership or delete the team." },
          { status: 400 },
        );
      }
    }
    await prisma.teamMember.delete({ where: { id: memberId } });
    return NextResponse.json({ success: true });
  }

  // Otherwise, need owner role to remove others
  const requester = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });
  if (!requester || !isRoleAtLeast(requester.role, "owner")) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  await prisma.teamMember.delete({ where: { id: memberId } });
  return NextResponse.json({ success: true });
}
