"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type React from "react";
import Link from "next/link";

interface CommentUser {
  name: string | null;
  picture: string | null;
}

interface GalleryCommentItem {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: CommentUser;
}

interface GalleryItem {
  id: string;
  type: "image" | "video";
  modelId: string;
  modelLabel: string;
  prompt: string;
  blobUrl: string;
  sourceUrl?: string;
  inputImageUrl?: string | null;
  generationMeta?: string | null;
  aspectRatio: string | null;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
  likeCount?: number;
  commentCount?: number;
  currentUserLiked?: boolean;
  user?: { id?: string; name: string | null; picture: string | null };
}

type Tab = "public" | "mine";
type Lang = "en" | "zh";

const TEXT = {
  en: {
    title: "Community",
    subtitle: "Community-created images & videos",
    create: "+ Create",
    dashboard: "<- Dashboard",
    signIn: "Sign in",
    publicTab: "Community Feed",
    mineTab: "My Items",
    loadFailed: "Failed to load gallery. Please try again.",
    retry: "Retry",
    hidden: "Hidden",
    video: "video",
    image: "image",
    by: "by",
    failedUpdate: "Failed to update",
    deleteConfirm: "Delete this item permanently?",
    makePrivate: "Make private",
    makePublic: "Make public",
    delete: "Delete",
    details: "Details",
    deletingFailed: "Failed to delete item",
    loading: "Loading...",
    noPublic: "No public items yet - be the first to generate one!",
    noMine: "You haven't generated anything yet.",
    toToolbox: "Go to AI Toolbox ->",
    loadMore: "Load more",
    like: "Like",
    liked: "Liked",
    follow: "Follow",
    following: "Following",
    addComment: "Add a comment...",
    postComment: "Post",
    signInToInteract: "Sign in to interact",
    noComments: "No comments yet",
    deleteComment: "Delete",
  },
  zh: {
    title: "作品社区",
    subtitle: "社区创作的图片与视频",
    create: "+ 去创作",
    dashboard: "<- 返回仪表盘",
    signIn: "登录",
    publicTab: "社区作品",
    mineTab: "我的作品",
    loadFailed: "加载失败，请重试。",
    retry: "重试",
    hidden: "未公开",
    video: "视频",
    image: "图片",
    by: "作者",
    failedUpdate: "更新失败",
    deleteConfirm: "确认永久删除该作品吗？",
    makePrivate: "设为私密",
    makePublic: "设为公开",
    delete: "删除",
    details: "详情",
    deletingFailed: "删除失败",
    loading: "加载中...",
    noPublic: "还没有公开作品，快来生成第一条吧！",
    noMine: "你还没有生成任何作品。",
    toToolbox: "前往 AI 工具箱 ->",
    loadMore: "加载更多",
    like: "点赞",
    liked: "已赞",
    follow: "关注",
    following: "已关注",
    addComment: "添加评论...",
    postComment: "发布",
    signInToInteract: "登录后互动",
    noComments: "暂无评论",
    deleteComment: "删除",
  },
} as const;

function useMasonryColumns(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCols(4);
      else if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

function aspectRatioStyle(ratio: string | null | undefined): React.CSSProperties {
  if (!ratio) return {};
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return {};
  return { aspectRatio: `${w}/${h}` };
}

function MediaCard({
  item,
  isOwner,
  lang,
  isLoggedIn,
  currentUserId,
  onToggle,
  onDelete,
}: {
  item: GalleryItem;
  isOwner: boolean;
  lang: Lang;
  isLoggedIn: boolean;
  currentUserId: string | null;
  onToggle?: (id: string, isPublic: boolean) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);
  const [liked, setLiked] = useState(item.currentUserLiked ?? false);
  const [likingBusy, setLikingBusy] = useState(false);

  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<GalleryCommentItem[]>([]);
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const t = TEXT[lang];

  const handleToggle = async () => {
    setToggling(true);
    setToggleError("");
    try {
      await onToggle?.(item.id, !item.isPublic);
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : t.failedUpdate);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t.deleteConfirm)) return;
    setDeleting(true);
    try {
      await onDelete?.(item.id);
    } catch {
      setDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn || likingBusy) return;
    setLikingBusy(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const res = await fetch(`/api/gallery/${item.id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setLikeCount(data.count);
      } else {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikingBusy(false);
    }
  };

  const loadComments = async () => {
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/gallery/${item.id}/comments`);
      const data = await res.json();
      if (res.ok) setComments(data.comments ?? []);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleToggleComments = () => {
    if (!commentOpen) {
      setCommentOpen(true);
      void loadComments();
    } else {
      setCommentOpen(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/gallery/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        setCommentCount((prev) => prev + 1);
        setCommentText("");
      }
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const res = await fetch(`/api/gallery/${item.id}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleFollow = async (authorId: string) => {
    if (!isLoggedIn || followBusy) return;
    setFollowBusy(true);
    const prev = following;
    setFollowing(!prev);
    try {
      const res = await fetch(`/api/users/${authorId}/follow`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setFollowing(data.following);
      else setFollowing(prev);
    } catch {
      setFollowing(prev);
    } finally {
      setFollowBusy(false);
    }
  };

  const authorId = item.user?.id;
  const isOwnContent = currentUserId && authorId === currentUserId;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="relative bg-gray-100 dark:bg-gray-700">
        {item.type === "video" ? (
          <video
            src={item.blobUrl}
            className="w-full object-cover"
            style={aspectRatioStyle(item.aspectRatio)}
            muted
            loop
            playsInline
            onMouseEnter={(e) => {
              const v = e.currentTarget as HTMLVideoElement & { _playP?: Promise<void> };
              v._playP = v.play() ?? Promise.resolve();
            }}
            onMouseLeave={(e) => {
              const v = e.currentTarget as HTMLVideoElement & { _playP?: Promise<void> };
              void (v._playP ?? Promise.resolve()).catch(() => {}).then(() => {
                v.pause();
                v.currentTime = 0;
              });
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.blobUrl}
            alt={item.prompt}
            className="w-full h-auto block"
            loading="lazy"
          />
        )}
        <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-1.5 py-0.5 rounded">
          {item.type === "video" ? `🎬 ${t.video}` : `🖼 ${t.image}`}
        </span>
        {isOwner && !item.isPublic && (
          <span className="absolute top-2 right-2 text-xs bg-yellow-500/90 text-white px-1.5 py-0.5 rounded">
            {t.hidden}
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <Link
          href={`/gallery/${item.id}`}
          className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t.details}
        </Link>
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
          {item.prompt}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 truncate">{item.modelLabel}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(item.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
          </span>
        </div>

        {/* Author + Follow */}
        {item.user?.name && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400 truncate">{t.by} {item.user.name}</p>
            {authorId && !isOwnContent && (
              <button
                onClick={() => handleFollow(authorId)}
                disabled={followBusy || !isLoggedIn}
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                  following
                    ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    : "border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                }`}
              >
                {following ? t.following : t.follow}
              </button>
            )}
          </div>
        )}

        {/* Like + Comment row */}
        <div className="flex items-center gap-3 pt-0.5">
          <button
            onClick={handleLike}
            disabled={!isLoggedIn || likingBusy}
            title={isLoggedIn ? (liked ? t.liked : t.like) : t.signInToInteract}
            className={`flex items-center gap-1 text-xs transition-colors disabled:opacity-50 ${
              liked ? "text-red-500" : "text-gray-400 hover:text-red-400"
            }`}
          >
            <span>{liked ? "❤️" : "🤍"}</span>
            <span>{likeCount}</span>
          </button>
          <button
            onClick={handleToggleComments}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            <span>💬</span>
            <span>{commentCount}</span>
          </button>
        </div>

        {toggleError && <p className="text-xs text-red-400">{toggleError}</p>}

        {/* Owner controls */}
        {isOwner && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="flex-1 text-xs py-1 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {toggling ? "..." : item.isPublic ? t.makePrivate : t.makePublic}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs py-1 px-2 rounded border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              {deleting ? "..." : t.delete}
            </button>
          </div>
        )}

        {/* Comment section */}
        {commentOpen && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2 space-y-2">
            {commentLoading ? (
              <p className="text-xs text-gray-400 text-center py-2">{t.loading}</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-1">{t.noComments}</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700 dark:text-gray-300 mr-1">
                        {c.user?.name ?? "?"}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 break-words">
                        {c.content}
                      </span>
                    </div>
                    {currentUserId === c.userId && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                        title={t.deleteComment}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isLoggedIn ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handlePostComment();
                    }
                  }}
                  placeholder={t.addComment}
                  maxLength={280}
                  className="flex-1 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                />
                <button
                  onClick={handlePostComment}
                  disabled={!commentText.trim() || postingComment}
                  className="text-xs px-2 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {postingComment ? "..." : t.postComment}
                </button>
              </div>
            ) : (
              <p className="text-xs text-center text-gray-400">
                <Link href="/login" className="text-blue-500 hover:underline">{t.signIn}</Link>
                {" "}{t.signInToInteract}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GalleryClientPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [tab, setTab] = useState<Tab>("public");
  const [publicItems, setPublicItems] = useState<GalleryItem[]>([]);
  const [myItems, setMyItems] = useState<GalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [publicError, setPublicError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myError, setMyError] = useState("");

  const t = TEXT[lang];

  useEffect(() => {
    const saved = localStorage.getItem("app-lang") || localStorage.getItem("gallery-lang");
    if (saved === "zh" || saved === "en") {
      setLang(saved);
      return;
    }
    if (navigator.language.toLowerCase().startsWith("zh")) {
      setLang("zh");
    }
  }, []);

  const updateLang = (nextLang: Lang) => {
    setLang(nextLang);
    localStorage.setItem("app-lang", nextLang);
    localStorage.setItem("gallery-lang", nextLang);
  };

  useEffect(() => {
    fetch("/api/gallery")
      .then(async (r) => {
        if (r.status === 401) {
          setIsLoggedIn(false);
          return;
        }
        if (!r.ok) {
          setIsLoggedIn(false);
          setMyError(t.loadFailed);
          return;
        }
        setIsLoggedIn(true);
        const d = await r.json();
        setMyItems(d.items ?? []);
        if (d.userId) setCurrentUserId(d.userId);
      })
      .catch(() => {
        setIsLoggedIn(false);
      });
  }, [t.loadFailed]);

  const loadPublic = useCallback(async (cursor?: string) => {
    const url = cursor
      ? `/api/gallery/public?cursor=${cursor}`
      : "/api/gallery/public";
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to load gallery (${r.status})`);
    return r.json() as Promise<{ items: GalleryItem[]; nextCursor: string | null }>;
  }, []);

  const fetchPublic = useCallback(() => {
    setLoading(true);
    setPublicError("");
    loadPublic()
      .then((d) => {
        setPublicItems(d.items);
        setNextCursor(d.nextCursor);
      })
      .catch(() => {
        setPublicError(t.loadFailed);
      })
      .finally(() => setLoading(false));
  }, [loadPublic, t.loadFailed]);

  useEffect(() => {
    fetchPublic();
  }, [fetchPublic]);

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const d = await loadPublic(nextCursor);
      setPublicItems((prev) => [...prev, ...d.items]);
      setNextCursor(d.nextCursor);
    } catch {
      setPublicError(t.loadFailed);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggle = async (id: string, isPublic: boolean) => {
    const r = await fetch(`/api/gallery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({} as { error?: string }));
      throw new Error(d.error || t.failedUpdate);
    }
    setMyItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isPublic } : item))
    );
    if (!isPublic) {
      setPublicItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleDelete = async (id: string) => {
    const r = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setMyError(t.deletingFailed);
      throw new Error("Delete failed");
    }
    setMyItems((prev) => prev.filter((item) => item.id !== id));
    setPublicItems((prev) => prev.filter((item) => item.id !== id));
  };

  const displayedItems = tab === "public" ? publicItems : myItems;
  const masonryCols = useMasonryColumns();
  const masonryColumns = useMemo(
    () =>
      Array.from({ length: masonryCols }, (_, ci) =>
        displayedItems.filter((_, idx) => idx % masonryCols === ci)
      ),
    [displayedItems, masonryCols]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <div className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => updateLang("en")}
                  className={`px-2 py-1 text-xs transition-colors ${
                    lang === "en"
                      ? "bg-gray-900 text-white"
                      : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => updateLang("zh")}
                  className={`px-2 py-1 text-xs transition-colors ${
                    lang === "zh"
                      ? "bg-gray-900 text-white"
                      : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  中文
                </button>
              </div>
              <Link href="/toolbox" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
                {t.create}
              </Link>
              {isLoggedIn && (
                <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  {t.dashboard}
                </Link>
              )}
              {isLoggedIn === false && (
                <Link href="/login" className="text-sm text-blue-600 hover:underline">
                  {t.signIn}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6 sm:mb-8 w-full max-w-xs">
          <button
            onClick={() => setTab("public")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "public"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
            }`}
          >
            {t.publicTab}
          </button>
          {isLoggedIn && (
            <button
              onClick={() => setTab("mine")}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === "mine"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              {t.mineTab}
            </button>
          )}
        </div>

        {publicError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span>{publicError}</span>
            <button
              onClick={fetchPublic}
              className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-700 hover:bg-red-100/60 dark:hover:bg-red-900/40"
            >
              {t.retry}
            </button>
          </div>
        )}

        {myError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {myError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="w-10 h-10 animate-spin text-purple-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">🖼</p>
            <p>{tab === "public" ? t.noPublic : t.noMine}</p>
            <Link href="/toolbox" className="mt-4 inline-block text-purple-600 hover:underline text-sm">
              {t.toToolbox}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex gap-4 items-start">
              {masonryColumns.map((col, ci) => (
                <div key={ci} className="flex-1 flex flex-col gap-4 min-w-0">
                  {col.map((item) => (
                    <MediaCard
                      key={item.id}
                      item={item}
                      isOwner={tab === "mine"}
                      lang={lang}
                      isLoggedIn={!!isLoggedIn}
                      currentUserId={currentUserId}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ))}
            </div>

            {tab === "public" && nextCursor && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? t.loading : t.loadMore}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
