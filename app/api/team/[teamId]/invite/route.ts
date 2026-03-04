import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { requireTeamRole } from "@/lib/team";
import type { TeamRole } from "@/lib/team";

type Params = { params: Promise<{ teamId: string }> };

/** POST /api/team/[teamId]/invite — create an email invitation */
export async function POST(request: NextRequest, { params }: Params) {
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
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = (body.role as TeamRole) || "editor";
  const validRoles: TeamRole[] = ["viewer", "editor"];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid role (use viewer or editor)" }, { status: 400 });
  }

  // Check if already a member
  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: existingUser.id, teamId } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User is already a team member" }, { status: 400 });
    }
  }

  // Check for existing pending invite
  const existingInvite = await prisma.teamInvitation.findFirst({
    where: { teamId, email, status: "pending" },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Invitation already pending for this email" }, { status: 400 });
  }

  const invitation = await prisma.teamInvitation.create({
    data: {
      teamId,
      email,
      role,
      invitedBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return NextResponse.json(invitation, { status: 201 });
}

/** GET /api/team/[teamId]/invite — list pending invitations */
export async function GET(_request: NextRequest, { params }: Params) {
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

  const invitations = await prisma.teamInvitation.findMany({
    where: { teamId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}

/** DELETE /api/team/[teamId]/invite — revoke an invitation */
export async function DELETE(request: NextRequest, { params }: Params) {
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

  const { searchParams } = new URL(request.url);
  const invitationId = searchParams.get("id");
  if (!invitationId) {
    return NextResponse.json({ error: "Invitation ID required" }, { status: 400 });
  }

  await prisma.teamInvitation.updateMany({
    where: { id: invitationId, teamId, status: "pending" },
    data: { status: "revoked" },
  });

  return NextResponse.json({ success: true });
}
