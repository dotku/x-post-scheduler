import { prisma } from "./db";
import { decrypt } from "./encryption";
import { XCredentials } from "./x-client";

export async function getUserXCredentials(
  userId: string
): Promise<XCredentials | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      xApiKey: true,
      xApiSecret: true,
      xAccessToken: true,
      xAccessTokenSecret: true,
    },
  });

  if (
    !user?.xApiKey ||
    !user?.xApiSecret ||
    !user?.xAccessToken ||
    !user?.xAccessTokenSecret
  ) {
    return null;
  }

  return {
    apiKey: decrypt(user.xApiKey),
    apiSecret: decrypt(user.xApiSecret),
    accessToken: decrypt(user.xAccessToken),
    accessTokenSecret: decrypt(user.xAccessTokenSecret),
  };
}
