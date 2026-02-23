"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledAt: Date | null;
  postedAt: Date | null;
  tweetId: string | null;
  error: string | null;
  createdAt: Date;
  source?: "db" | "x";
  impressionCount?: number | null;
  mediaAssetId?: string | null;
  mediaUrls?: string | null;
  resolvedMediaUrl?: string | null;
}

interface PostListProps {
  initialPosts: Post[];
}

export default function PostList({ initialPosts }: PostListProps) {
  const t = useTranslations("postList");
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<Post | null>(null);

  const decodeHtml = (value: string) => {
    if (!value) return value;
    if (typeof window === "undefined" || typeof DOMParser === "undefined") {
      return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, "text/html");
    return doc.documentElement.textContent ?? value;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    setOpenMenuId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        if (detailPost?.id === id) setDetailPost(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpload = async (id: string, status: string) => {
    if (status === "scheduled" && !confirm("Post this immediately?")) return;
    setUploadingId(id);
    try {
      const res = await fetch(`/api/posts/${id}/post-now`, { method: "POST" });
      if (res.ok) router.refresh();
    } catch (error) {
      console.error("Failed to upload:", error);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await fetch(`/api/posts/${id}/pull-media`, { method: "POST" });
      const text = await res.text();
      if (res.ok) {
        const data = JSON.parse(text);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, mediaUrls: JSON.stringify(data.mediaUrls), resolvedMediaUrl: data.mediaUrls[0] ?? null }
              : p
          )
        );
        setDetailPost((prev) =>
          prev?.id === id
            ? { ...prev, mediaUrls: JSON.stringify(data.mediaUrls), resolvedMediaUrl: data.mediaUrls[0] ?? null }
            : prev
        );
      } else {
        let msg = t("syncFromX") + " failed";
        try { msg = JSON.parse(text).error || msg; } catch { /* ignore */ }
        alert(msg);
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return styles[status] || styles.draft;
  };

  const formatTime = (post: Post) => {
    if (post.postedAt) return `${t("postedAt")} ${format(new Date(post.postedAt), "PPp")}`;
    if (post.scheduledAt) return `${t("scheduledAt")} ${format(new Date(post.scheduledAt), "PPp")}`;
    return format(new Date(post.createdAt), "PPp");
  };

  if (posts.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t("noPosts")}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("noPostsHint")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-0">
        {posts.map((post) => {
          const imgSrc = post.resolvedMediaUrl ?? null;
          const isDb = post.source !== "x";
          const canUpload = isDb && (post.status === "scheduled" || post.status === "failed");
          const canSync = !!post.tweetId && isDb;
          const menuOpen = openMenuId === post.id;

          return (
            <div
              key={post.id}
              className="relative break-inside-avoid mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Top-right icon group */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                {/* Upload to X */}
                {canUpload && (
                  <button
                    onClick={() => handleUpload(post.id, post.status)}
                    disabled={uploadingId === post.id}
                    title={post.status === "failed" ? t("retryPost") : t("uploadToX")}
                    className="p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-40 shadow-sm"
                  >
                    {uploadingId === post.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Sync from X */}
                {canSync && (
                  <button
                    onClick={() => handleSync(post.id)}
                    disabled={syncingId === post.id}
                    title={t("syncMedia")}
                    className="p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700 transition-colors disabled:opacity-40 shadow-sm"
                  >
                    <svg
                      className={`w-3.5 h-3.5 ${syncingId === post.id ? "animate-spin" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                )}

                {/* ··· Menu */}
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(menuOpen ? null : post.id)}
                    title={t("moreOptions")}
                    className="p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 top-7 z-30 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 text-sm">
                        <button
                          onClick={() => { setDetailPost(post); setOpenMenuId(null); }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                        >
                          {t("viewDetails")}
                        </button>
                        {post.tweetId && (
                          <a
                            href={`https://x.com/i/status/${post.tweetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenuId(null)}
                            className="block px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                          >
                            {t("viewOnX")}
                          </a>
                        )}
                        {isDb && (
                          <>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                            <button
                              onClick={() => handleDelete(post.id)}
                              disabled={deletingId === post.id}
                              className="w-full text-left px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50"
                            >
                              {deletingId === post.id ? t("deleting") : t("delete")}
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Image */}
              {imgSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc} alt="Post media" className="w-full object-cover" />
              )}

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(post.status)}`}>
                    {post.status}
                  </span>
                  {post.impressionCount != null && (
                    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {post.impressionCount.toLocaleString()}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words mb-3">
                  {decodeHtml(post.content)}
                </p>

                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatTime(post)}
                </p>

                {post.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2 mt-2">
                    {post.error}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {detailPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDetailPost(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(detailPost.status)}`}>
                  {detailPost.status}
                </span>
                {detailPost.impressionCount != null && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {detailPost.impressionCount.toLocaleString()} {t("impressions")}
                  </span>
                )}
              </div>
              <button onClick={() => setDetailPost(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {detailPost.resolvedMediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detailPost.resolvedMediaUrl} alt="Post media" className="w-full object-cover" />
            )}

            <div className="px-5 py-4 space-y-4">
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words leading-relaxed">
                {decodeHtml(detailPost.content)}
              </p>

              <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
                <p>{formatTime(detailPost)}</p>
                <p>Created {format(new Date(detailPost.createdAt), "PPp")}</p>
              </div>

              {detailPost.error && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <p className="font-medium mb-1">{t("error")}</p>
                  <p>{detailPost.error}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1 flex-wrap">
                {detailPost.tweetId && (
                  <a href={`https://x.com/i/status/${detailPost.tweetId}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {t("viewOnX")}
                  </a>
                )}
                {detailPost.source !== "x" && detailPost.tweetId && (
                  <button
                    onClick={() => handleSync(detailPost.id)}
                    disabled={syncingId === detailPost.id}
                    className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50"
                  >
                    <svg className={`w-3 h-3 ${syncingId === detailPost.id ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {syncingId === detailPost.id ? t("syncing") : t("syncFromX")}
                  </button>
                )}
                {detailPost.source !== "x" && (detailPost.status === "scheduled" || detailPost.status === "failed") && (
                  <button
                    onClick={() => { handleUpload(detailPost.id, detailPost.status); setDetailPost(null); }}
                    disabled={uploadingId === detailPost.id}
                    className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {detailPost.status === "failed" ? t("retry") : t("postNow")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
