import { NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

/** Mask an API key for display: show first 4 and last 4 chars */
function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

/** GET — retrieve masked BYOK provider keys */
export async function GET() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { seedanceApiKey: true },
  });

  let seedanceApiKey: string | null = null;
  if (dbUser?.seedanceApiKey) {
    try {
      const decrypted = decrypt(dbUser.seedanceApiKey);
      seedanceApiKey = maskKey(decrypted);
    } catch {
      seedanceApiKey = "****";
    }
  }

  return NextResponse.json({ seedanceApiKey });
}

/** PUT — store or clear BYOK provider keys */
export async function PUT(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { seedanceApiKey } = body as { seedanceApiKey?: string | null };

  const data: { seedanceApiKey: string | null } = { seedanceApiKey: null };

  if (seedanceApiKey && seedanceApiKey.trim()) {
    const trimmed = seedanceApiKey.trim();
    // Basic validation: Seedance keys start with "sk-"
    if (!trimmed.startsWith("sk-")) {
      return NextResponse.json(
        { error: "Invalid Seedance API key format (should start with sk-)" },
        { status: 400 },
      );
    }
    data.seedanceApiKey = encrypt(trimmed);
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  // Return the masked version
  const masked = data.seedanceApiKey
    ? maskKey(seedanceApiKey!.trim())
    : null;

  return NextResponse.json({ seedanceApiKey: masked });
}
