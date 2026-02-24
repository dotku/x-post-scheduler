import { requireAuth } from "./auth0";
import { auth0 } from "./auth0-client";

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

function normalizeRole(value: string) {
  return value.trim().toLowerCase();
}

function isTruthy(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function isAuth0AdminOnlyEnabled() {
  return isTruthy(process.env.AUTH0_ADMIN_ONLY);
}

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
        .map(normalizeRole)
        .filter(Boolean);
    }
    if (typeof raw === "string") {
      return raw.split(",").map(normalizeRole).filter(Boolean);
    }
  }
  return [];
}

function getPermissionsFromSessionUser(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const obj = user as Record<string, unknown>;

  const configured = process.env.AUTH0_PERMISSIONS_CLAIM?.trim();
  const keys = configured
    ? [configured, ...DEFAULT_PERMISSION_CLAIM_KEYS]
    : DEFAULT_PERMISSION_CLAIM_KEYS;

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

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getIdTokenPayloadFromSession(
  session: unknown,
): Record<string, unknown> | null {
  if (!session || typeof session !== "object") return null;
  const sessionObj = session as Record<string, unknown>;
  const tokenSet =
    sessionObj.tokenSet && typeof sessionObj.tokenSet === "object"
      ? (sessionObj.tokenSet as Record<string, unknown>)
      : null;
  if (!tokenSet) return null;

  const idToken =
    (typeof tokenSet.idToken === "string" && tokenSet.idToken) ||
    (typeof tokenSet.id_token === "string" && tokenSet.id_token) ||
    null;
  if (!idToken) return null;

  return decodeJwtPayload(idToken);
}

function uniqueLowerCase(values: string[]) {
  return Array.from(
    new Set(values.map((item) => item.trim().toLowerCase()).filter(Boolean)),
  );
}

function isAdminByIdentityFallback(params: {
  email?: string | null;
  auth0Sub?: string | null;
}) {
  const adminEmails = parseSet(process.env.ADMIN_EMAILS);
  const adminSubs = parseSet(process.env.ADMIN_AUTH0_SUBS);
  const email = params.email?.toLowerCase();
  const sub = params.auth0Sub?.toLowerCase();
  return Boolean(
    (email && adminEmails.has(email)) || (sub && adminSubs.has(sub)),
  );
}

export async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const idTokenPayload = getIdTokenPayloadFromSession(session);
  const roles = uniqueLowerCase([
    ...getRolesFromSessionUser(session.user),
    ...getRolesFromSessionUser(idTokenPayload),
  ]);
  const permissions = uniqueLowerCase([
    ...getPermissionsFromSessionUser(session.user),
    ...getPermissionsFromSessionUser(idTokenPayload),
  ]);
  const isAdminByRole = roles.includes("admin");
  const isAdminByPermission =
    permissions.includes("admin") ||
    permissions.includes("read:admin") ||
    permissions.includes("manage:admin");
  const auth0AdminOnly = isAuth0AdminOnlyEnabled();
  const isAdmin =
    isAdminByRole ||
    isAdminByPermission ||
    (!auth0AdminOnly &&
      isAdminByIdentityFallback({
        email: session.user.email ?? null,
        auth0Sub: session.user.sub ?? null,
      }));
  if (!isAdmin) {
    throw new Error("FORBIDDEN");
  }

  // Keep user sync behavior via existing auth path.
  return requireAuth();
}
