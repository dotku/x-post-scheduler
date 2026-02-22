import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0-client";

function pickArrayClaims(user: Record<string, unknown>) {
  const claims: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(user)) {
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
      claims[key] = value as string[];
    }
  }
  return claims;
}

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = session.user as Record<string, unknown>;
  return NextResponse.json({
    authenticated: true,
    email: typeof user.email === "string" ? user.email : null,
    sub: typeof user.sub === "string" ? user.sub : null,
    roleClaimHint: process.env.AUTH0_ROLES_CLAIM ?? null,
    permissionClaimHint: process.env.AUTH0_PERMISSIONS_CLAIM ?? null,
    arrayClaims: pickArrayClaims(user),
  });
}
