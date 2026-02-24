import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";
import { TwitterApi } from "twitter-api-v2";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

function decrypt(enc: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const [ivB64, authTagB64, ciphertextB64] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]).toString("utf8");
}

async function main() {
  console.log("=== Step 1: Check DB state ===");
  const user = await prisma.user.findFirst({
    where: { email: "weijingjaylin@gmail.com" },
    select: { id: true },
  });
  if (!user) { console.log("User not found"); return; }

  const accounts = await prisma.xAccount.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, label: true, username: true, isDefault: true, createdAt: true,
      followersCount: true, followingCount: true, lastSyncedAt: true,
      xApiKey: true, xApiSecret: true, xAccessToken: true, xAccessTokenSecret: true,
    },
  });

  for (const a of accounts) {
    console.log(`\nAccount: ${a.username ?? a.id}`);
    console.log(`  followersCount: ${a.followersCount} (${typeof a.followersCount})`);
    console.log(`  followingCount: ${a.followingCount} (${typeof a.followingCount})`);
    console.log(`  lastSyncedAt: ${a.lastSyncedAt}`);
    console.log(`  lastSyncedAt != null → ${a.lastSyncedAt != null}`);
  }

  console.log("\n=== Step 2: Run sync now ===");
  for (const account of accounts) {
    try {
      const client = new TwitterApi({
        appKey: decrypt(account.xApiKey),
        appSecret: decrypt(account.xApiSecret),
        accessToken: decrypt(account.xAccessToken),
        accessSecret: decrypt(account.xAccessTokenSecret),
      });
      const me = await client.v1.verifyCredentials({ skip_status: true });
      console.log(`  v1 result: screen_name=${me.screen_name}, followers=${me.followers_count}, following=${me.friends_count}`);

      await prisma.xAccount.update({
        where: { id: account.id },
        data: {
          followersCount: me.followers_count ?? 0,
          followingCount: me.friends_count ?? 0,
          username: me.screen_name || account.username,
          lastSyncedAt: new Date(),
        },
      });
      console.log("  ✅ DB updated");
    } catch (e) {
      console.log(`  ❌ Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n=== Step 3: Verify DB after sync ===");
  const after = await prisma.xAccount.findMany({
    where: { userId: user.id },
    select: { username: true, followersCount: true, followingCount: true, lastSyncedAt: true },
  });
  console.log(JSON.stringify(after, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
