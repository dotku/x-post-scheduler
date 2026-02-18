import { requireAuth } from "./auth0";

function parseSet(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminByIdentity(params: { email?: string | null; auth0Sub?: string | null }) {
  const adminEmails = parseSet(process.env.ADMIN_EMAILS);
  const adminSubs = parseSet(process.env.ADMIN_AUTH0_SUBS);

  const email = params.email?.toLowerCase();
  const sub = params.auth0Sub?.toLowerCase();

  return Boolean((email && adminEmails.has(email)) || (sub && adminSubs.has(sub)));
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (!isAdminByIdentity({ email: user.email, auth0Sub: user.auth0Sub })) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
