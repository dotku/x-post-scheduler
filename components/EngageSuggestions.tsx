"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

interface Suggestion {
  tweetId: string;
  originalTweet: string;
  metrics: {
    replies: number;
    likes: number;
    impressions: number;
  };
  suggestedReply: string;
}

export default function EngageSuggestions() {
  const t = useTranslations("engage");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [remainingReplies, setRemainingReplies] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch("/api/engage/suggestions");
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || t("empty"));
          return;
        }
        setSuggestions(data.suggestions ?? []);
        setMessage(data.message ?? "");
        setRemainingReplies(data.remainingReplies ?? 0);
        setDailyLimit(data.dailyLimit ?? 10);
      } catch {
        setMessage(t("empty"));
      } finally {
        setLoading(false);
      }
    }
    void fetchSuggestions();
  }, []);

  const handleSendReply = async (tweetId: string, content: string) => {
    setSendingId(tweetId);
    setErrorId(null);
    try {
      const res = await fetch("/api/engage/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetId, content }),
      });
      if (!res.ok) throw new Error();
      setSentIds((prev) => new Set(prev).add(tweetId));
      setRemainingReplies((prev) => Math.max(0, prev - 1));
      setEditingId(null);
    } catch {
      setErrorId(tweetId);
    } finally {
      setSendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8 p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        </div>
      </div>
    );
  }

  const isEmpty = suggestions.length === 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between text-left border-b border-gray-200 dark:border-gray-700"
      >
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("suggestions")}
          </h2>
          {!isEmpty && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {suggestions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("quota", { remaining: remainingReplies, limit: dailyLimit })}
          </span>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {isEmpty && (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {message || t("empty")}
              </p>
            </div>
          )}
          {suggestions.map((s) => {
            const isSent = sentIds.has(s.tweetId);
            const isSending = sendingId === s.tweetId;
            const isEditing = editingId === s.tweetId;
            const hasError = errorId === s.tweetId;
            const replyContent = isEditing ? editText : s.suggestedReply;

            return (
              <div key={s.tweetId} className="px-6 py-4 space-y-3">
                {/* Original tweet */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("originalTweet")}
                  </p>
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-3">
                    {s.originalTweet}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t("metrics", {
                      replies: s.metrics.replies,
                      likes: s.metrics.likes,
                      impressions: s.metrics.impressions,
                    })}
                  </p>
                </div>

                {/* Suggested reply */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("suggestedReply")}
                  </p>
                  {isEditing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={280}
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  ) : (
                    <div className="text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                      {s.suggestedReply}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isSent ? (
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      {t("sent")}
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSendReply(s.tweetId, replyContent)}
                        disabled={isSending || remainingReplies <= 0}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isSending ? "…" : t("send")}
                      </button>
                      {isEditing ? (
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(s.tweetId);
                            setEditText(s.suggestedReply);
                          }}
                          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                        >
                          {t("edit")}
                        </button>
                      )}
                    </>
                  )}
                  {hasError && (
                    <span className="text-sm text-red-500">{t("error")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
