import { prisma } from "./db";
import crypto from "crypto";

export type TeamRole = "owner" | "editor" | "viewer";

const ROLE_HIERARCHY: TeamRole[] = ["viewer", "editor", "owner"];

export function isRoleAtLeast(role: string, minRole: TeamRole): boolean {
  return ROLE_HIERARCHY.indexOf(role as TeamRole) >= ROLE_HIERARCHY.indexOf(minRole);
}

export function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex"); // 8-char hex
}

/** Get all teams a user belongs to, with their role. */
export async function getUserTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          inviteCode: true,
          creditBalanceCents: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({
    teamId: m.team.id,
    name: m.team.name,
    inviteCode: m.team.inviteCode,
    creditBalanceCents: m.team.creditBalanceCents,
    memberCount: m.team._count.members,
    role: m.role as TeamRole,
    joinedAt: m.joinedAt,
    createdAt: m.team.createdAt,
  }));
}

/** Get a team with the requesting user's role. Returns null if user is not a member. */
export async function getTeamWithRole(teamId: string, userId: string) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
    include: {
      team: true,
    },
  });

  if (!membership) return null;

  return {
    team: membership.team,
    role: membership.role as TeamRole,
  };
}

/** Throws if user doesn't have at least the given role on the team. */
export async function requireTeamRole(
  teamId: string,
  userId: string,
  minRole: TeamRole,
): Promise<{ team: Awaited<ReturnType<typeof getTeamWithRole>>; role: TeamRole }> {
  const result = await getTeamWithRole(teamId, userId);
  if (!result) {
    throw new Error("NOT_A_MEMBER");
  }
  if (!isRoleAtLeast(result.role, minRole)) {
    throw new Error("INSUFFICIENT_ROLE");
  }
  return { team: result, role: result.role };
}

/** Check if a team has remaining credits (> 0). */
export async function hasTeamCredits(teamId: string): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { creditBalanceCents: true },
  });
  return (team?.creditBalanceCents ?? 0) > 0;
}

/** Get a team's current credit balance in cents. */
export async function getTeamCreditBalance(teamId: string): Promise<number> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { creditBalanceCents: true },
  });
  return team?.creditBalanceCents ?? 0;
}

/** Atomically deduct credits from a team's balance. */
export async function deductTeamCredits(params: {
  teamId: string;
  costCents: number;
  performedBy: string;
  description: string;
}): Promise<{ costCents: number; newBalance: number }> {
  const result = await prisma.team.updateMany({
    where: { id: params.teamId, creditBalanceCents: { gte: params.costCents } },
    data: { creditBalanceCents: { decrement: params.costCents } },
  });

  if (result.count === 0) {
    throw new Error("INSUFFICIENT_TEAM_CREDITS");
  }

  const team = await prisma.team.findUniqueOrThrow({
    where: { id: params.teamId },
    select: { creditBalanceCents: true },
  });

  await prisma.teamCreditTransaction.create({
    data: {
      teamId: params.teamId,
      type: "deduction",
      amountCents: -params.costCents,
      balanceAfter: team.creditBalanceCents,
      description: params.description,
      performedBy: params.performedBy,
    },
  });

  return { costCents: params.costCents, newBalance: team.creditBalanceCents };
}

/** Add credits to a team's balance. */
export async function addTeamCredits(params: {
  teamId: string;
  amountCents: number;
  performedBy: string;
  description: string;
  type?: "topup" | "transfer_in";
}): Promise<number> {
  const team = await prisma.team.update({
    where: { id: params.teamId },
    data: { creditBalanceCents: { increment: params.amountCents } },
    select: { creditBalanceCents: true },
  });

  await prisma.teamCreditTransaction.create({
    data: {
      teamId: params.teamId,
      type: params.type ?? "topup",
      amountCents: params.amountCents,
      balanceAfter: team.creditBalanceCents,
      description: params.description,
      performedBy: params.performedBy,
    },
  });

  return team.creditBalanceCents;
}

/**
 * Transfer credits from a user's personal balance to a team.
 * Atomic: deducts from user, adds to team, logs both transactions.
 */
export async function transferCreditsToTeam(params: {
  userId: string;
  teamId: string;
  amountCents: number;
}): Promise<{ userBalance: number; teamBalance: number }> {
  if (params.amountCents <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  // Verify user is owner of the team
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId: params.userId, teamId: params.teamId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("ONLY_OWNER_CAN_TRANSFER");
  }

  // Atomic deduction from user
  const userResult = await prisma.user.updateMany({
    where: { id: params.userId, creditBalanceCents: { gte: params.amountCents } },
    data: { creditBalanceCents: { decrement: params.amountCents } },
  });
  if (userResult.count === 0) {
    throw new Error("INSUFFICIENT_CREDITS");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: params.userId },
    select: { creditBalanceCents: true },
  });

  // Record user-side transaction
  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      type: "deduction",
      amountCents: -params.amountCents,
      balanceAfter: user.creditBalanceCents,
      description: `Transfer to team`,
      metadata: JSON.stringify({ teamId: params.teamId }),
    },
  });

  // Add to team
  const team = await prisma.team.update({
    where: { id: params.teamId },
    data: { creditBalanceCents: { increment: params.amountCents } },
    select: { creditBalanceCents: true },
  });

  // Record team-side transaction
  await prisma.teamCreditTransaction.create({
    data: {
      teamId: params.teamId,
      type: "transfer_in",
      amountCents: params.amountCents,
      balanceAfter: team.creditBalanceCents,
      description: `Transfer from personal credits`,
      performedBy: params.userId,
    },
  });

  return {
    userBalance: user.creditBalanceCents,
    teamBalance: team.creditBalanceCents,
  };
}
