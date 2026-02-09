"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledAt: Date | null;
  postedAt: Date | null;
  tweetId: string | null;
  error: string | null;
  createdAt: Date;
}

interface PostListProps {
  initialPosts: Post[];
}

export default function PostList({ initialPosts }: PostListProps) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handlePostNow = async (id: string) => {
    if (!confirm("Post this immediately?")) return;

    try {
      const res = await fetch(`/api/posts/${id}/post-now`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to post:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      posted:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return styles[status] || styles.draft;
  };

  if (posts.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No posts yet
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Get started by scheduling your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {posts.map((post) => (
        <div
          key={post.id}
          className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-750"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {post.content}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                    post.status
                  )}`}
                >
                  {post.status}
                </span>
                {post.scheduledAt && (
                  <span>
                    Scheduled: {format(new Date(post.scheduledAt), "PPp")}
                  </span>
                )}
                {post.postedAt && (
                  <span>Posted: {format(new Date(post.postedAt), "PPp")}</span>
                )}
                {post.tweetId && (
                  <a
                    href={`https://x.com/i/status/${post.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on X
                  </a>
                )}
              </div>
              {post.error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  Error: {post.error}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {post.status === "scheduled" && (
                <button
                  onClick={() => handlePostNow(post.id)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Post Now
                </button>
              )}
              <button
                onClick={() => handleDelete(post.id)}
                disabled={deletingId === post.id}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
              >
                {deletingId === post.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
