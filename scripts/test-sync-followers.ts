import { PrismaClient } from "@prisma/client";
import { createDecipheriv } from "crypto";
import { TwitterApi } from "twitter-api-v2";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

function decrypt(encryptedText: string): string {
  const key = process.env.ENCRYPTION_KEY!;
  const buf = Buffer.from(key, "hex");
  const [ivB64, authTagB64, ciphertextB64] = encryptedText.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", buf, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

async function main() {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email: "weijingjaylin@gmail.com" },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log("❌ User not found: weijingjaylin@gmail.com");
    return;
  }
  console.log(`✅ Found user: ${user.email} (id: ${user.id})`);

  // Fetch XAccounts
  const accounts = await prisma.xAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      username: true,
      followersCount: true,
      lastSyncedAt: true,
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  console.log(`\n📋 Found ${accounts.length} X account(s):`);

  for (const account of accounts) {
    console.log(`\n--- Account: ${account.label ?? account.username ?? account.id} ---`);
    console.log(`  username: ${account.username}`);
    console.log(`  followersCount in DB: ${account.followersCount}`);
    console.log(`  lastSyncedAt: ${account.lastSyncedAt}`);

    try {
      const apiKey = decrypt(account.xApiKey);
      const apiSecret = decrypt(account.xApiSecret);
      const accessToken = decrypt(account.xAccessToken);
      const accessTokenSecret = decrypt(account.xAccessTokenSecret);

      console.log(`  apiKey: ${apiKey.slice(0, 6)}...`);

      const client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken,
        accessSecret: accessTokenSecret,
      });

      // Test v2 me
      console.log("\n  [v2.me() test]");
      try {
        const me = await client.v2.me({ "user.fields": ["public_metrics"] });
        console.log(`  ✅ v2.me username: ${me.data.username}`);
        console.log(`  public_metrics: ${JSON.stringify(me.data.public_metrics)}`);
      } catch (e) {
        console.log(`  ❌ v2.me failed: ${e instanceof Error ? e.message : e}`);
      }

      // Test v1 verifyCredentials
      console.log("\n  [v1.verifyCredentials() test]");
      try {
        const me1 = await client.v1.verifyCredentials({ skip_status: true });
        console.log(`  ✅ v1 screen_name: ${me1.screen_name}`);
        console.log(`  followers_count: ${me1.followers_count}`);
        console.log(`  friends_count: ${me1.friends_count}`);
      } catch (e) {
        console.log(`  ❌ v1.verifyCredentials failed: ${e instanceof Error ? e.message : e}`);
      }
    } catch (e) {
      console.log(`  ❌ Decrypt error: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
