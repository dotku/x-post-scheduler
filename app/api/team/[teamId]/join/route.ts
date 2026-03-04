import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";

type Params = { params: Promise<{ teamId: string }> };

/** POST /api/team/[teamId]/join — join via invite code or accept email invitation */
export async function POST(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  const body = await request.json();

  // Check if already a member
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: user.id, teamId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already a member of this team" }, { status: 400 });
  }

  // Method 1: Join via invite code
  if (body.inviteCode) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { inviteCode: true },
    });

    if (!team || team.inviteCode !== body.inviteCode) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
    }

    const member = await prisma.teamMember.create({
      data: { userId: user.id, teamId, role: "viewer" },
    });

    return NextResponse.json(member, { status: 201 });
  }

  // Method 2: Accept email invitation
  if (body.invitationId) {
    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        id: body.invitationId,
        teamId,
        status: "pending",
        expiresAt: { gte: new Date() },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found or expired" }, { status: 400 });
    }

    // Verify the invitation email matches the user
    if (user.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email" },
        { status: 403 },
      );
    }

    const [member] = await Promise.all([
      prisma.teamMember.create({
        data: { userId: user.id, teamId, role: invitation.role },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: "accepted" },
      }),
    ]);

    return NextResponse.json(member, { status: 201 });
  }

  return NextResponse.json(
    { error: "Provide inviteCode or invitationId" },
    { status: 400 },
  );
}
