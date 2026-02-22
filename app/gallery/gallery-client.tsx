"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface GalleryItem {
  id: string;
  type: "image" | "video";
  modelId: string;
  modelLabel: string;
  prompt: string;
  blobUrl: string;
  aspectRatio: string | null;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
  user?: { name: string | null; picture: string | null };
}

type Tab = "public" | "mine";
type Lang = "en" | "zh";

const TEXT = {
  en: {
    title: "AI Gallery",
    subtitle: "Community-generated images & videos",
    create: "+ Create",
    dashboard: "<- Dashboard",
    signIn: "Sign in",
    publicTab: "Public Gallery",
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
    deletingFailed: "Failed to delete item",
    loading: "Loading...",
    noPublic: "No public items yet - be the first to generate one!",
    noMine: "You haven't generated anything yet.",
    toToolbox: "Go to AI Toolbox ->",
    loadMore: "Load more",
  },
  zh: {
    title: "AI 画廊",
    subtitle: "社区创作的图片与视频",
    create: "+ 去创作",
    dashboard: "<- 返回仪表盘",
    signIn: "登录",
    publicTab: "公开画廊",
    mineTab: "我的作品",
    loadFailed: "加载画廊失败，请重试。",
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
    deletingFailed: "删除失败",
    loading: "加载中...",
    noPublic: "还没有公开作品，快来生成第一条吧！",
    noMine: "你还没有生成任何作品。",
    toToolbox: "前往 AI 工具箱 ->",
    loadMore: "加载更多",
  },
} as const;

function MediaCard({
  item,
  isOwner,
  lang,
  onToggle,
  onDelete,
}: {
  item: GalleryItem;
  isOwner: boolean;
  lang: Lang;
  onToggle?: (id: string, isPublic: boolean) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggleError, setToggleError] = useState("");

  const t = TEXT[lang];

  const handleToggle = async () => {
    setToggling(true);
    setToggleError("");
    try {
      await onToggle?.(item.id, !item.isPublic);
    } catch {
      setToggleError(t.failedUpdate);
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
      <div className="relative bg-gray-100 dark:bg-gray-700">
        {item.type === "video" ? (
          <video
            src={item.blobUrl}
            className="w-full aspect-video object-cover"
            muted
            loop
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={(e) => {
              const v = e.currentTarget as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.blobUrl}
            alt={item.prompt}
            className="w-full object-cover"
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
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug">
          {item.prompt}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 truncate">{item.modelLabel}</span>
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(item.createdAt).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US")}
          </span>
        </div>
        {item.user?.name && (
          <p className="text-xs text-gray-400 truncate">{t.by} {item.user.name}</p>
        )}

        {toggleError && <p className="text-xs text-red-400">{toggleError}</p>}

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
  const [myError, setMyError] = useState("");

  const t = TEXT[lang];

  useEffect(() => {
    const saved = localStorage.getItem("gallery-lang");
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
    if (!r.ok) throw new Error("Toggle failed");
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.title}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {t.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-4">
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
              <Link
                href="/toolbox"
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                {t.create}
              </Link>
              {isLoggedIn && (
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-8 max-w-xs">
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
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center justify-between gap-3">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedItems.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isOwner={tab === "mine"}
                  lang={lang}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
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
