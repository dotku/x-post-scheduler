import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRecentTweets } from "@/lib/x-client";
import { getAuthenticatedUser } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { format } from "date-fns";
import PostList from "@/components/PostList";
import UserMenu from "@/components/UserMenu";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const MAX_POSTS = 100;

async function getPosts(userId: string) {
  const dbPosts = await prisma.post.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_POSTS,
  });
  type DbPost = (typeof dbPosts)[number];

  if (dbPosts.length >= MAX_POSTS) {
    return { dbPosts, mergedPosts: dbPosts };
  }

  const credentials = await getUserXCredentials(userId);
  if (!credentials) {
    return { dbPosts, mergedPosts: dbPosts };
  }

  try {
    const existingTweetIds = new Set<string>(
      dbPosts
        .map((post: DbPost) => post.tweetId)
        .filter(
          (tweetId: DbPost["tweetId"]): tweetId is string =>
            typeof tweetId === "string" && tweetId.length > 0
        )
    );
    const remaining = MAX_POSTS - dbPosts.length;
    const recentTweets = await getRecentTweets(
      remaining,
      existingTweetIds,
      credentials.credentials
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

    return { dbPosts, mergedPosts: [...dbPosts, ...apiPosts] };
  } catch (error) {
    console.error("Failed to load recent tweets:", error);
    return { dbPosts, mergedPosts: dbPosts };
  }
}

async function getRecurringSchedules(userId: string) {
  const schedules = await prisma.recurringSchedule.findMany({
    where: { isActive: true, userId },
    orderBy: { nextRunAt: "asc" },
  });
  return schedules;
}

export default async function Dashboard() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const { dbPosts, mergedPosts } = await getPosts(user.id);
  const schedules = await getRecurringSchedules(user.id);

  type DbPost = (typeof dbPosts)[number];
  const scheduledCount = dbPosts.filter(
    (p: DbPost) => p.status === "scheduled"
  ).length;
  const postedCount = dbPosts.filter(
    (p: DbPost) => p.status === "posted"
  ).length;
  const failedCount = dbPosts.filter(
    (p: DbPost) => p.status === "failed"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              X Post Scheduler
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href="/gallery"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="Public Gallery Feed"
              >
                Gallery Feed
              </Link>
              <Link
                href="/toolbox"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="Media Studio"
              >
                Media Studio
              </Link>
              <Link
                href="/generate"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="AI Writer"
              >
                AI Writer
              </Link>
              <Link
                href="/schedule"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="Compose Post"
              >
                Compose Post
              </Link>
              <Link
                href="/recurring"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="Recurring Posts"
              >
                Recurring Posts
              </Link>
              <Link
                href="/knowledge"
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4"
                title="Knowledge Base"
              >
                Knowledge Base
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1 hidden sm:block" />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <svg
                  className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Scheduled
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {scheduledCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Posted
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {postedCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Failed
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {failedCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Recurring Schedules */}
        {schedules.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Active Recurring Schedules
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="text-gray-900 dark:text-white line-clamp-1">
                      {schedule.useAi
                        ? `AI generated${schedule.aiPrompt ? `: ${schedule.aiPrompt}` : ""}`
                        : schedule.content}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {schedule.frequency} - Next:{" "}
                      {format(new Date(schedule.nextRunAt), "PPp")}
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
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
              All Posts
            </h2>
          </div>
          <PostList initialPosts={mergedPosts} />
        </div>
      </main>
    </div>
  );
}
