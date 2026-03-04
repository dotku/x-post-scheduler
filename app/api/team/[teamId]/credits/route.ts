import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { requireTeamRole, transferCreditsToTeam } from "@/lib/team";

type Params = { params: Promise<{ teamId: string }> };

/** GET /api/team/[teamId]/credits — get balance and recent transactions */
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

  const [team, transactions] = await Promise.all([
    prisma.team.findUnique({
      where: { id: teamId },
      select: { creditBalanceCents: true },
    }),
    prisma.teamCreditTransaction.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({
    balanceCents: team?.creditBalanceCents ?? 0,
    transactions,
  });
}

/** POST /api/team/[teamId]/credits — transfer personal credits to team */
export async function POST(request: NextRequest, { params }: Params) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const { teamId } = await params;
  const body = await request.json();
  const amountCents = typeof body.amountCents === "number" ? Math.floor(body.amountCents) : 0;

  if (amountCents <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  try {
    const result = await transferCreditsToTeam({
      userId: user.id,
      teamId,
      amountCents,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transfer failed";
    const status =
      msg === "ONLY_OWNER_CAN_TRANSFER" ? 403 :
      msg === "INSUFFICIENT_CREDITS" ? 402 :
      msg === "INVALID_AMOUNT" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
