import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0-client";
import { requireAdmin } from "@/lib/admin";

const DEFAULT_ROLE_CLAIM_KEYS = [
  "https://x-post-scheduler/roles",
  "https://xpostscheduler/roles",
  "roles",
];

const DEFAULT_PERMISSION_CLAIM_KEYS = [
  "https://x-post-scheduler/permissions",
  "https://xpostscheduler/permissions",
  "permissions",
];

function parseSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isTruthy(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readStringArrayClaim(user: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = user[key];
    if (Array.isArray(raw)) {
      const values = raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      if (values.length > 0) return values;
    }
    if (typeof raw === "string") {
      const values = raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      if (values.length > 0) return values;
    }
  }
  return [];
}

function pickArrayClaims(user: Record<string, unknown>) {
  const claims: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(user)) {
    if (Array.isArray(value) && value.every((x) => typeof x === "string")) {
      claims[key] = value as string[];
    }
  }
  return claims;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const sessionRecord = session as unknown as Record<string, unknown>;
  const tokenSet =
    sessionRecord.tokenSet && typeof sessionRecord.tokenSet === "object"
      ? (sessionRecord.tokenSet as Record<string, unknown>)
      : null;
  const idTokenRaw =
    (typeof tokenSet?.idToken === "string" && tokenSet.idToken) ||
    (typeof tokenSet?.id_token === "string" && tokenSet.id_token) ||
    null;
  const idTokenPayload = idTokenRaw ? decodeJwtPayload(idTokenRaw) : null;

  const user = session.user as Record<string, unknown>;
  const roleClaim = process.env.AUTH0_ROLES_CLAIM?.trim();
  const permissionClaim = process.env.AUTH0_PERMISSIONS_CLAIM?.trim();
  const roleClaimKeys = roleClaim
    ? [roleClaim, ...DEFAULT_ROLE_CLAIM_KEYS]
    : DEFAULT_ROLE_CLAIM_KEYS;
  const permissionClaimKeys = permissionClaim
    ? [permissionClaim, ...DEFAULT_PERMISSION_CLAIM_KEYS]
    : DEFAULT_PERMISSION_CLAIM_KEYS;

  const roles = readStringArrayClaim(user, roleClaimKeys);
  const permissions = readStringArrayClaim(user, permissionClaimKeys);
  const idTokenRoles = idTokenPayload
    ? readStringArrayClaim(idTokenPayload, roleClaimKeys)
    : [];
  const idTokenPermissions = idTokenPayload
    ? readStringArrayClaim(idTokenPayload, permissionClaimKeys)
    : [];
  const email =
    typeof user.email === "string" ? user.email.toLowerCase() : null;
  const sub = typeof user.sub === "string" ? user.sub.toLowerCase() : null;

  const adminEmails = parseSet(process.env.ADMIN_EMAILS);
  const adminSubs = parseSet(process.env.ADMIN_AUTH0_SUBS);
  const auth0AdminOnly = isTruthy(process.env.AUTH0_ADMIN_ONLY);

  const isAdminByRole = roles.includes("admin");
  const isAdminByPermission =
    permissions.includes("admin") ||
    permissions.includes("read:admin") ||
    permissions.includes("manage:admin");
  const isAdminByFallback = Boolean(
    (email && adminEmails.has(email)) || (sub && adminSubs.has(sub)),
  );
  const wouldPassRequireAdmin =
    isAdminByRole ||
    isAdminByPermission ||
    (!auth0AdminOnly && isAdminByFallback);

  // Show all claim keys with their types so we can debug what Auth0 is sending
  const allClaims: Record<string, { type: string; value: unknown }> = {};
  for (const [key, value] of Object.entries(user)) {
    allClaims[key] = {
      type: Array.isArray(value) ? "array" : typeof value,
      value,
    };
  }

  return NextResponse.json({
    authenticated: true,
    email: typeof user.email === "string" ? user.email : null,
    sub: typeof user.sub === "string" ? user.sub : null,
    roleClaimHint: process.env.AUTH0_ROLES_CLAIM ?? null,
    permissionClaimHint: process.env.AUTH0_PERMISSIONS_CLAIM ?? null,
    auth0AdminOnly,
    evaluated: {
      roleClaimKeys,
      permissionClaimKeys,
      roles,
      permissions,
      idTokenRoles,
      idTokenPermissions,
      isAdminByRole,
      isAdminByPermission,
      isAdminByFallback,
      wouldPassRequireAdmin,
    },
    sessionDebug: {
      sessionKeys: Object.keys(sessionRecord),
      tokenSetKeys: tokenSet ? Object.keys(tokenSet) : [],
      hasIdToken: Boolean(idTokenRaw),
      idTokenClaimKeys: idTokenPayload ? Object.keys(idTokenPayload) : [],
      idTokenClaims: idTokenPayload,
    },
    arrayClaims: pickArrayClaims(user),
    allClaims,
  });
}
