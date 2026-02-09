import Link from "next/link";
import { prisma } from "@/lib/db";
import { getRecentTweets } from "@/lib/x-client";
import { format } from "date-fns";
import PostList from "@/components/PostList";
import UserMenu from "@/components/UserMenu";
import type { Post } from "@prisma/client";

export const dynamic = "force-dynamic";

const MAX_POSTS = 100;

async function getPosts() {
  const dbPosts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_POSTS,
  });
  type DbPost = (typeof dbPosts)[number];

  if (dbPosts.length >= MAX_POSTS) {
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
    const recentTweets = await getRecentTweets(remaining, existingTweetIds);
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
    }));

    return { dbPosts, mergedPosts: [...dbPosts, ...apiPosts] };
  } catch (error) {
    console.error("Failed to load recent tweets:", error);
    return { dbPosts, mergedPosts: dbPosts };
  }
}

async function getRecurringSchedules() {
  const schedules = await prisma.recurringSchedule.findMany({
    where: { isActive: true },
    orderBy: { nextRunAt: "asc" },
  });
  return schedules;
}

export default async function Dashboard() {
  const { dbPosts, mergedPosts } = await getPosts();
  const schedules = await getRecurringSchedules();

  const scheduledCount = dbPosts.filter(
    (p: Post) => p.status === "scheduled"
  ).length;
  const postedCount = dbPosts.filter((p: Post) => p.status === "posted").length;
  const failedCount = dbPosts.filter((p: Post) => p.status === "failed").length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              X Post Scheduler
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/generate"
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                AI Generate
              </Link>
              <Link
                href="/schedule"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Post
              </Link>
              <Link
                href="/recurring"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Recurring
              </Link>
              <Link
                href="/knowledge"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                Knowledge
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2 hidden sm:block" />
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
                      {schedule.content}
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
