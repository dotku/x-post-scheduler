import { NextResponse } from "next/server";
import { auth0 } from "./auth0-client";

export interface AuthenticatedUser {
  id: string;
  auth0Sub: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth0.getSession();
  if (!session?.user) {
    return null;
  }

  const { sub, email, name, picture } = session.user;
  const { prisma } = await import("./db");

  const user = await prisma.user.upsert({
    where: { auth0Sub: sub },
    update: { email, name, picture },
    create: { auth0Sub: sub, email, name, picture },
  });

  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const DEFAULT_ROLE_CLAIM_KEYS = [
  "https://x-post-scheduler/roles",
  "https://xpostscheduler/roles",
  "roles",
];

function getRolesFromSessionUser(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const obj = user as Record<string, unknown>;
  const configured = process.env.AUTH0_ROLES_CLAIM?.trim();
  const keys = configured
    ? [configured, ...DEFAULT_ROLE_CLAIM_KEYS]
    : DEFAULT_ROLE_CLAIM_KEYS;

  for (const key of keys) {
    const raw = obj[key];
    if (Array.isArray(raw)) {
      return raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    }
  }

  return [];
}

export async function isGuestSessionUser() {
  const session = await auth0.getSession();
  if (!session?.user) return false;
  const roles = getRolesFromSessionUser(session.user);
  return roles.includes("guest");
}
