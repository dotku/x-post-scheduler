"use client";

import { useTranslations } from "next-intl";

interface PostMetric {
  id: string;
  content: string;
  tweetId: string | null;
  postedAt: Date | null;
  impressions: number;
  likes: number;
  replies: number;
  engagements: number;
  engagementRate: number;
  account: {
    label: string | null;
    username: string | null;
  } | null;
}

interface PostPerformanceTableProps {
  posts: PostMetric[];
}

export default function PostPerformanceTable({ posts }: PostPerformanceTableProps) {
  const t = useTranslations("analytics");

  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        {t("noData")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("post")}
            </th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("likes")}
            </th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              {t("engagementRate")}
            </th>
            <th className="text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("impressions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr
              key={post.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                    {post.content}
                  </p>
                  {post.tweetId && (
                    <a
                      href={`https://x.com/i/web/status/${post.tweetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("viewOnX")}
                    </a>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {post.likes.toLocaleString()}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {post.engagementRate}%
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {post.impressions.toLocaleString()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
