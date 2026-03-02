"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";

type SourceType = "website" | "weixin_channel";

interface KnowledgeMedia {
  id: string;
  blobUrl: string;
  altText: string | null;
  mimeType: string | null;
  mediaType: string;
  duration: number | null;
  thumbnailBlobUrl: string | null;
}

interface KnowledgeSource {
  id: string;
  url: string;
  name: string;
  type?: SourceType;
  content: string;
  metadata?: string | null;
  pagesScraped: number;
  lastScraped: string | null;
  isActive: boolean;
  createdAt: string;
  images?: KnowledgeMedia[];
  _count?: { images: number };
}

export default function KnowledgePage() {
  const t = useTranslations("knowledge");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingContent, setSavingContent] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("website");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rescraping, setRescraping] = useState<string | null>(null);

  // Video download state
  const [downloadingVideos, setDownloadingVideos] = useState<string | null>(null);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);

  // QR Login state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"idle" | "loading" | "pending" | "scanned" | "success" | "expired" | "error">("idle");
  const [qrError, setQrError] = useState("");
  const qrSessionRef = useRef<string | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [weixinConnected, setWeixinConnected] = useState(false);

  useEffect(() => { fetchSources(); fetchWeixinStatus(); }, []);

  const fetchSources = async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) {
        console.error("[knowledge] fetch failed:", res.status);
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      setSources(data);
    } catch (err) {
      console.error("[knowledge] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeixinStatus = async () => {
    try {
      const res = await fetch("/api/weixin/status");
      if (res.ok) {
        const data = await res.json();
        setWeixinConnected(data.connected);
      }
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (sourceType === "weixin_channel") {
      if (!url.trim() || !name.trim()) { setError(t("errorFieldsChannel")); return; }
    } else {
      if (!url.trim() || !name.trim()) { setError(t("errorFields")); return; }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name, type: sourceType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("errorAdd"));
      setUrl(""); setName("");
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorAdd"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    await fetch(`/api/knowledge/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    fetchSources();
  };

  const handleRescrape = async (id: string) => {
    setRescraping(id);
    try {
      await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescrape: true }),
      });
      fetchSources();
    } finally { setRescraping(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteConfirm"))) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    fetchSources();
  };

  const handleStartEdit = (source: KnowledgeSource) => {
    setEditingId(source.id);
    setEditContent(source.content);
    setExpandedId(source.id);
  };

  const handleSaveContent = async (id: string) => {
    setSavingContent(true);
    try {
      await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      setEditingId(null);
      fetchSources();
    } finally {
      setSavingContent(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleDownloadVideos = async (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId);
    if (!source?.metadata) return;

    setDownloadingVideos(sourceId);
    try {
      const metadata = JSON.parse(source.metadata);
      const allVideos = metadata.videos || [];

      if (allVideos.length === 0) {
        alert(t("noVideoUrl"));
        return;
      }

      // Send all videos — the API will resolve URLs for those without sourceUrl
      const res = await fetch(`/api/knowledge/${sourceId}/download-videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrls: allVideos.map((v: { videoUrl?: string; objectId?: string; title?: string; duration?: number }) => ({
            sourceUrl: v.videoUrl || undefined,
            objectId: v.objectId || undefined,
            title: v.title,
            duration: v.duration,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(t("videosDownloaded", { count: data.downloaded }));
      } else {
        alert(data.error || "Download failed");
      }
      fetchSources();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingVideos(null);
    }
  };

  const stopQrPolling = useCallback(() => {
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
  }, []);

  const handleStartQrLogin = async () => {
    setQrModalOpen(true);
    setQrStatus("loading");
    setQrError("");
    setQrImage(null);
    stopQrPolling();

    try {
      const res = await fetch("/api/weixin/qr-login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start QR login");

      qrSessionRef.current = data.sessionId;
      setQrImage(data.qrCodeBase64);
      setQrStatus("pending");

      // Start polling
      qrPollRef.current = setInterval(async () => {
        if (!qrSessionRef.current) return;
        try {
          const statusRes = await fetch(
            `/api/weixin/qr-login/status?sessionId=${qrSessionRef.current}`
          );
          const statusData = await statusRes.json();

          if (statusData.status === "success") {
            setQrStatus("success");
            setWeixinConnected(true);
            stopQrPolling();
            // Auto-close after 2s
            setTimeout(() => {
              setQrModalOpen(false);
              setQrStatus("idle");
            }, 2000);
          } else if (statusData.status === "scanned") {
            setQrStatus("scanned");
          } else if (statusData.status === "expired") {
            setQrStatus("expired");
            stopQrPolling();
          }
        } catch {
          // Ignore polling errors, will retry
        }
      }, 2000);
    } catch (err) {
      setQrStatus("error");
      setQrError(err instanceof Error ? err.message : "Failed to start QR login");
    }
  };

  const handleCloseQrModal = () => {
    setQrModalOpen(false);
    stopQrPolling();
    qrSessionRef.current = null;
    setQrStatus("idle");
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopQrPolling();
  }, [stopQrPolling]);

  const getSourceDisplayUrl = (source: KnowledgeSource) => {
    if (source.type === "weixin_channel") {
      const channelId = source.url.replace("weixin-channel://", "");
      return `https://channels.weixin.qq.com/web/pages/home?finderUserName=${channelId}`;
    }
    return source.url;
  };

  const getSourceTypeLabel = (source: KnowledgeSource) => {
    if (source.type === "weixin_channel") return t("typeWeixinChannel");
    return t("typeWebsite");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t("title")}</h1>
            <Link href={`${prefix}/dashboard`} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("addSource")}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {sourceType === "weixin_channel" ? t("addChannelDesc") : t("addSourceDesc")}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Source type selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("sourceType")}</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setSourceType("website"); setUrl(""); setError(""); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    sourceType === "website"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}>
                  {t("typeWebsite")}
                </button>
                <button type="button" onClick={() => { setSourceType("weixin_channel"); setUrl(""); setError(""); }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    sourceType === "weixin_channel"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}>
                  {t("typeWeixinChannel")}
                </button>
              </div>
            </div>

            {sourceType === "weixin_channel" && (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                {weixinConnected ? (
                  <>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                      {t("weixinConnected")}
                    </span>
                    <button type="button" onClick={handleStartQrLogin}
                      className="px-3 py-1.5 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors">
                      {t("reconnectWeChat")}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={handleStartQrLogin}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                      {t("connectWeChat")}
                    </button>
                    <span className="text-sm text-green-700 dark:text-green-400">{t("connectWeChatHint")}</span>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("sourceName")}</label>
                <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={sourceType === "weixin_channel" ? t("channelNamePlaceholder") : t("sourceNamePlaceholder")}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white" />
              </div>
              <div>
                {sourceType === "weixin_channel" ? (
                  <>
                    <label htmlFor="channelId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("channelId")}</label>
                    <input type="text" id="channelId" value={url} onChange={(e) => setUrl(e.target.value)}
                      placeholder={t("channelIdPlaceholder")}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white" />
                  </>
                ) : (
                  <>
                    <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t("websiteUrl")}</label>
                    <input type="url" id="url" value={url} onChange={(e) => setUrl(e.target.value)}
                      placeholder={t("urlPlaceholder")}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white" />
                  </>
                )}
              </div>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={isSubmitting}
                className={`px-6 py-2 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  sourceType === "weixin_channel"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}>
                {isSubmitting
                  ? (sourceType === "weixin_channel" ? t("fetchingChannel") : t("adding"))
                  : t("addButton")}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("yourSources", { count: sources.length })}
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">{t("loading")}</div>
          ) : sources.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">{t("noSources")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sources.map((source) => (
                <div key={source.id} className="px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{source.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          source.type === "weixin_channel"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        }`}>
                          {getSourceTypeLabel(source)}
                        </span>
                        {!source.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">{t("inactive")}</span>
                        )}
                      </div>
                      <a href={getSourceDisplayUrl(source)} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block">
                        {source.type === "weixin_channel"
                          ? source.url.replace("weixin-channel://", "")
                          : source.url}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {source.lastScraped
                          ? t("lastScraped", { date: format(new Date(source.lastScraped), "PPp") })
                          : t("neverScraped")}{" "}
                        | {source.pagesScraped} {t("pages")} | {source.content.length.toLocaleString()} {t("chars")} |{" "}
                        {source._count?.images ?? source.images?.length ?? 0} {source.type === "weixin_channel" ? t("media") : t("images")}
                      </p>
                      {source.images && source.images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {source.images
                            .filter((m) => m.mediaType !== "image") // Show thumbnails and videos first for channels
                            .concat(source.images.filter((m) => m.mediaType === "image"))
                            .slice(0, 6)
                            .map((media) => (
                              <div key={media.id} className="relative h-14 w-14">
                                {media.mediaType === "video" ? (
                                  <button
                                    type="button"
                                    onClick={() => setVideoPlayerUrl(media.blobUrl)}
                                    className="relative h-14 w-14 group"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={media.thumbnailBlobUrl || media.blobUrl}
                                      alt={media.altText || source.name}
                                      className="h-14 w-14 rounded border border-gray-200 dark:border-gray-700 object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded group-hover:bg-black/40 transition-colors">
                                      <svg className="w-5 h-5 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                      </svg>
                                    </div>
                                    {media.duration && (
                                      <span className="absolute bottom-0 right-0 text-[9px] text-white bg-black/70 px-0.5 rounded-tl">
                                        {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, "0")}
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={media.blobUrl}
                                    alt={media.altText || source.name}
                                    className="h-14 w-14 rounded border border-gray-200 dark:border-gray-700 object-cover"
                                  />
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button onClick={() => handleToggle(source.id, source.isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${source.isActive ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${source.isActive ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      {(source.type !== "weixin_channel" || weixinConnected) && (
                        <button onClick={() => handleRescrape(source.id)} disabled={rescraping === source.id}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50">
                          {rescraping === source.id ? "..." : t("refresh")}
                        </button>
                      )}
                      {source.type === "weixin_channel" && weixinConnected && source.metadata && (
                        <button onClick={() => handleDownloadVideos(source.id)} disabled={downloadingVideos === source.id}
                          className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50">
                          {downloadingVideos === source.id ? t("downloadingVideos") : t("downloadVideos")}
                        </button>
                      )}
                      <button onClick={() => handleStartEdit(source)}
                        className="px-3 py-1.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors">
                        {t("edit")}
                      </button>
                      <button onClick={() => { setExpandedId(expandedId === source.id ? null : source.id); if (editingId === source.id) handleCancelEdit(); }}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                        {expandedId === source.id ? t("hide") : t("view")}
                      </button>
                      <button onClick={() => handleDelete(source.id)}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                        {t("delete")}
                      </button>
                    </div>
                  </div>
                  {expandedId === source.id && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      {editingId === source.id ? (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("editContent")}</h4>
                            <div className="flex gap-2">
                              <button onClick={handleCancelEdit}
                                className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                                {t("cancel")}
                              </button>
                              <button onClick={() => handleSaveContent(source.id)} disabled={savingContent}
                                className="px-3 py-1 text-xs text-white bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50">
                                {savingContent ? t("saving") : t("save")}
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={12}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm font-mono"
                          />
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t("scrapedPreview")}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {source.content.substring(0, 2000)}{source.content.length > 2000 && "..."}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* QR Login Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("qrLoginTitle")}</h3>
              <button onClick={handleCloseQrModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl">&times;</button>
            </div>

            {qrStatus === "loading" && (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("qrLoading")}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{t("qrLoadingHint")}</p>
              </div>
            )}

            {(qrStatus === "pending" || qrStatus === "scanned") && qrImage && (
              <div className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImage} alt="WeChat QR Code" className="mx-auto w-64 h-64 rounded-lg border border-gray-200 dark:border-gray-700" />
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  {qrStatus === "scanned" ? t("qrScanned") : t("qrScanPrompt")}
                </p>
              </div>
            )}

            {qrStatus === "success" && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">&#10003;</div>
                <p className="text-green-600 dark:text-green-400 font-medium">{t("qrSuccess")}</p>
              </div>
            )}

            {qrStatus === "expired" && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-3">{t("qrExpired")}</p>
                <button onClick={handleStartQrLogin}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  {t("qrRetry")}
                </button>
              </div>
            )}

            {qrStatus === "error" && (
              <div className="text-center py-8">
                <p className="text-red-500 mb-3">{qrError || t("qrErrorGeneric")}</p>
                <button onClick={handleStartQrLogin}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
                  {t("qrRetry")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {videoPlayerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setVideoPlayerUrl(null)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setVideoPlayerUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl"
            >
              &times;
            </button>
            <video
              src={videoPlayerUrl}
              controls
              autoPlay
              className="w-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
