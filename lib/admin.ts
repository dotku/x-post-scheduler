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
      .filter(Boolean)
  );
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase();
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
      return raw
        .split(",")
        .map(normalizeRole)
        .filter(Boolean);
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

function isAdminByIdentityFallback(params: {
  email?: string | null;
  auth0Sub?: string | null;
}) {
  const adminEmails = parseSet(process.env.ADMIN_EMAILS);
  const adminSubs = parseSet(process.env.ADMIN_AUTH0_SUBS);
  const email = params.email?.toLowerCase();
  const sub = params.auth0Sub?.toLowerCase();
  return Boolean((email && adminEmails.has(email)) || (sub && adminSubs.has(sub)));
}

export async function requireAdmin() {
  const session = await auth0.getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }

  const roles = getRolesFromSessionUser(session.user);
  const permissions = getPermissionsFromSessionUser(session.user);
  const isAdminByRole = roles.includes("admin");
  const isAdminByPermission =
    permissions.includes("admin") ||
    permissions.includes("read:admin") ||
    permissions.includes("manage:admin");
  const isAdmin =
    isAdminByRole ||
    isAdminByPermission ||
    isAdminByIdentityFallback({
      email: session.user.email ?? null,
      auth0Sub: session.user.sub ?? null,
    });
  if (!isAdmin) {
    throw new Error("FORBIDDEN");
  }

  // Keep user sync behavior via existing auth path.
  return requireAuth();
}
