import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRecentTweets } from "@/lib/x-client";
import { getAuthenticatedUser } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { buildSignedBlobProxyUrl } from "@/lib/blob-proxy";
import { format } from "date-fns";
import PostList from "@/components/PostList";
import UserMenu from "@/components/UserMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AccountStats from "@/components/AccountStats";
import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getTranslations, getLocale, setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

const MAX_POSTS = 100;

function resolveMediaUrl(rawUrl: string, origin: string): string {
  if (!rawUrl) return rawUrl;
  if (rawUrl.includes("/api/toolbox/blob-proxy")) return rawUrl;
  if (rawUrl.includes(".private.blob.vercel-storage.com")) {
    try {
      return buildSignedBlobProxyUrl(origin, rawUrl);
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

function resolvePostMediaUrl(
  mediaUrls: string | null,
  origin: string,
): string | null {
  if (!mediaUrls) return null;
  try {
    const arr = JSON.parse(mediaUrls);
    const first = Array.isArray(arr) && arr[0] ? String(arr[0]) : null;
    return first ? resolveMediaUrl(first, origin) : null;
  } catch {
    return null;
  }
}

async function getPosts(userId: string, origin: string) {
  const dbPosts = await prisma.post.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_POSTS,
  });
  type DbPost = (typeof dbPosts)[number];

  const resolvedDbPosts = dbPosts.map((p) => ({
    ...p,
    resolvedMediaUrl: p.mediaAssetId
      ? `/api/media/${p.mediaAssetId}`
      : resolvePostMediaUrl(p.mediaUrls, origin),
    impressionCount: p.impressions ?? null,
  }));

  if (dbPosts.length >= MAX_POSTS) {
    return { dbPosts, mergedPosts: resolvedDbPosts };
  }

  const credentials = await getUserXCredentials(userId);
  if (!credentials) {
    return { dbPosts, mergedPosts: resolvedDbPosts };
  }

  try {
    const existingTweetIds = new Set<string>(
      dbPosts
        .map((post: DbPost) => post.tweetId)
        .filter(
          (tweetId: DbPost["tweetId"]): tweetId is string =>
            typeof tweetId === "string" && tweetId.length > 0,
        ),
    );
    const remaining = MAX_POSTS - dbPosts.length;
    const recentTweets = await getRecentTweets(
      remaining,
      existingTweetIds,
      credentials.credentials,
    );
    const apiPosts = recentTweets.map((tweet) => ({
      id: `x-${tweet.id}`,
      content: tweet.text,
      status: "posted",
      scheduledAt: null,
      postedAt: tweet.createdAt,
      tweetId: tweet.id,
      error: null,
      createdAt: tweet.createdAt ?? new Date(0),
      source: "x" as const,
      impressionCount: tweet.impressionCount,
    }));

    return { dbPosts, mergedPosts: [...resolvedDbPosts, ...apiPosts] };
  } catch (error) {
    console.error("Failed to load recent tweets:", error);
    return { dbPosts, mergedPosts: resolvedDbPosts };
  }
}

async function getRecurringSchedules(userId: string) {
  const schedules = await prisma.recurringSchedule.findMany({
    where: { isActive: true, userId },
    orderBy: { nextRunAt: "asc" },
  });
  return schedules;
}

export default async function Dashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);

  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(locale === "zh" ? "/zh/login" : "/login");
  }

  // Redirect to user's preferred locale if different from current URL locale
  const preferredLocale = user.language || "en";
  if (preferredLocale !== locale) {
    redirect(preferredLocale === "zh" ? "/zh/dashboard" : "/dashboard");
  }

  const headersList = await nextHeaders();
  const host = headersList.get("host") || "localhost:3000";
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  const origin =
    process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
    process.env.APP_BASE_URL ||
    `${proto}://${host}`;

  const { mergedPosts } = await getPosts(user.id, origin);
  const schedules = await getRecurringSchedules(user.id);

  const prefix = locale === "zh" ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              <Link
                href={prefix || "/"}
                className="hover:opacity-80 transition-opacity"
              >
                {tNav("appTitle")}
              </Link>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href={`${prefix}/gallery`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
              >
                {tNav("gallery")}
              </Link>
              <Link
                href={`${prefix}/toolbox`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
              >
                {tNav("toolbox")}
              </Link>
              <Link
                href={`${prefix}/generate`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
              >
                {tNav("generate")}
              </Link>
              <Link
                href={`${prefix}/recurring`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
              >
                {tNav("autoPost")}
              </Link>
              <Link
                href={`${prefix}/knowledge`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
              >
                {tNav("knowledge")}
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1 hidden sm:block" />
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Post Activity Stats */}
        <AccountStats />

        {/* Active Recurring Schedules */}
        {schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("activeAutoPosts")}
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-900 dark:text-white line-clamp-1">
                      {schedule.useAi
                        ? `${t("aiGenerated")}${schedule.aiPrompt ? `: ${schedule.aiPrompt}` : ""}`
                        : schedule.content}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {schedule.frequency} - {t("next")}:{" "}
                      {format(new Date(schedule.nextRunAt), "PPp")}
                    </p>
                  </div>
                  <span className="inline-flex items-center shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {t("active")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("allPosts")}
            </h2>
          </div>
          <PostList initialPosts={mergedPosts} />
        </div>
      </main>
    </div>
  );
}
