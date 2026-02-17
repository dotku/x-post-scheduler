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
