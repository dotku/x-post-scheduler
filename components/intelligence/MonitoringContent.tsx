"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  DEMO_TEMPLATES,
  type DemoTemplate,
} from "@/lib/sentiment-monitor-templates";

// ── Types ────────────────────────────────────────────────────────────────────

interface TopicSummary {
  id: string;
  name: string;
  nameZh: string | null;
  description: string | null;
  keywords: string;
  createdAt: string;
  updatedAt: string;
  _count: { snapshots: number };
  snapshots: Array<{ createdAt: string }>;
}

interface Snapshot {
  id: string;
  tweetCount: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  avgScore: number;
  themes: string | null;
  topTweets: string | null;
  aiSummary: string | null;
  rawQuery: string | null;
  modelId: string | null;
  createdAt: string;
}

interface TopicDetail {
  id: string;
  name: string;
  nameZh: string | null;
  description: string | null;
  keywords: string;
  snapshots: Snapshot[];
}

interface XAccount {
  id: string;
  label: string | null;
  username: string | null;
  isDefault: boolean;
}

type View = "list" | "detail" | "result";

// ── Constants ────────────────────────────────────────────────────────────────

const SENTIMENT_COLORS = {
  positive: "#22c55e",
  neutral: "#94a3b8",
  negative: "#ef4444",
};

const TOOLTIP_STYLE = {
  backgroundColor: "rgb(31,41,55)",
  border: "none",
  borderRadius: "8px",
  color: "#fff",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function MonitoringContent({ locale }: { locale: string }) {
  const t = useTranslations("monitoring");
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  // State
  const [view, setView] = useState<View>("list");
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicDetail | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [tierBlocked, setTierBlocked] = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [creating, setCreating] = useState(false);

  // X accounts
  const [xAccounts, setXAccounts] = useState<XAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/monitoring");
      if (res.status === 403) {
        setTierBlocked(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to load topics");
      const data = await res.json();
      setTopics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTopicDetail = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/monitoring/${id}`);
      if (!res.ok) throw new Error("Failed to load topic");
      const data: TopicDetail = await res.json();
      setSelectedTopic(data);
      setView("detail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      if (data.xAccounts) {
        setXAccounts(data.xAccounts);
        const defaultAcc = data.xAccounts.find(
          (a: XAccount) => a.isDefault,
        );
        if (defaultAcc) setSelectedAccountId(defaultAcc.id);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchTopics();
    fetchAccounts();
  }, [fetchTopics, fetchAccounts]);

  // ── Actions ────────────────────────────────────────────────────────────

  async function createTopic() {
    if (!newName.trim() || newKeywords.length === 0) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          keywords: newKeywords,
        }),
      });
      if (!res.ok) {
        let errorMsg = `Failed to create (${res.status})`;
        try {
          const d = await res.json();
          if (d.error) errorMsg = d.error;
        } catch {
          /* empty body */
        }
        throw new Error(errorMsg);
      }
      setNewName("");
      setNewDesc("");
      setNewKeywords([]);
      setShowCreate(false);
      await fetchTopics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await fetch(`/api/monitoring/${id}`, { method: "DELETE" });
      if (view === "detail" || view === "result") {
        setView("list");
        setSelectedTopic(null);
        setSelectedSnapshot(null);
      }
      await fetchTopics();
    } catch {
      /* ignore */
    }
  }

  async function runAnalysis() {
    if (!selectedTopic) return;
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(
        `/api/monitoring/${selectedTopic.id}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            xAccountId: selectedAccountId || undefined,
            locale,
          }),
        },
      );
      if (!res.ok) {
        let errorMsg = `Analysis failed (${res.status})`;
        try {
          const d = await res.json();
          if (d.error) errorMsg = d.error;
        } catch {
          /* empty body */
        }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      // Refresh topic detail to get latest snapshot
      await fetchTopicDetail(selectedTopic.id);
      // Show the result
      if (data.snapshot) {
        setSelectedSnapshot(data.snapshot);
        setView("result");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function useTemplate(tpl: DemoTemplate) {
    setNewName(isZh ? tpl.nameZh : tpl.name);
    setNewDesc(isZh ? tpl.descriptionZh : tpl.description);
    setNewKeywords([...tpl.keywords]);
    setShowCreate(true);
  }

  function addKeyword() {
    const kw = keywordInput.trim();
    if (kw && !newKeywords.includes(kw)) {
      setNewKeywords([...newKeywords, kw]);
    }
    setKeywordInput("");
  }

  // ── Tier gate UI ───────────────────────────────────────────────────────

  if (tierBlocked) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {t("title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t("silverRequired")}
          </p>
          <Link
            href={`${prefix}/settings?tab=billing`}
            className="inline-flex items-center px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("upgrade")}
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">
            ✕
          </button>
        </div>
      )}

      {/* Navigation within monitoring */}
      {view !== "list" && (
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => {
              if (view === "result") {
                setView("detail");
                setSelectedSnapshot(null);
              } else {
                setView("list");
                setSelectedTopic(null);
              }
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← {t("back")}
          </button>
        </div>
      )}

      {/* ── List View ─────────────────────────────────────────────── */}
      {view === "list" && (
        <>
          {/* Create button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("title")}
            </h2>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showCreate ? t("cancel") : t("newTopic")}
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("topicName")}
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("topicNamePlaceholder")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("description")}
                </label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("keywords")}
                </label>
                <div className="flex gap-2">
                  <input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword();
                      }
                    }}
                    placeholder={t("keywordsPlaceholder")}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={addKeyword}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    +
                  </button>
                </div>
                {newKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                      >
                        {kw}
                        <button
                          onClick={() =>
                            setNewKeywords(
                              newKeywords.filter((k) => k !== kw),
                            )
                          }
                          className="hover:text-red-500"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={createTopic}
                disabled={
                  creating || !newName.trim() || newKeywords.length === 0
                }
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? t("creating") : t("create")}
              </button>
            </div>
          )}

          {/* Topic list */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : topics.length === 0 && !showCreate ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {t("noTopics")}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                {t("createFirst")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic) => {
                const keywords: string[] = JSON.parse(topic.keywords);
                const lastAnalyzed = topic.snapshots[0]?.createdAt;
                return (
                  <div
                    key={topic.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => fetchTopicDetail(topic.id)}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {isZh && topic.nameZh ? topic.nameZh : topic.name}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTopic(topic.id);
                        }}
                        className="text-gray-400 hover:text-red-500 text-xs"
                      >
                        {t("delete")}
                      </button>
                    </div>
                    {topic.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {topic.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {keywords.slice(0, 4).map((kw) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded"
                        >
                          {kw}
                        </span>
                      ))}
                      {keywords.length > 4 && (
                        <span className="px-2 py-0.5 text-gray-400 text-xs">
                          +{keywords.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-xs text-gray-400 flex items-center justify-between">
                      <span>
                        {t("snapshotCount", {
                          count: topic._count.snapshots,
                        })}
                      </span>
                      <span>
                        {lastAnalyzed
                          ? `${t("lastAnalyzed")}: ${new Date(lastAnalyzed).toLocaleDateString()}`
                          : t("never")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Demo templates */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("templates")}
            </h3>

            {/* Election */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t("electionTemplates")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DEMO_TEMPLATES.filter(
                  (tpl) => tpl.category === "election",
                ).map((tpl) => (
                  <TemplateCard
                    key={tpl.name}
                    tpl={tpl}
                    isZh={isZh}
                    onUse={() => useTemplate(tpl)}
                    label={t("useTemplate")}
                  />
                ))}
              </div>
            </div>

            {/* Finance */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t("financeTemplates")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEMO_TEMPLATES.filter(
                  (tpl) => tpl.category === "finance",
                ).map((tpl) => (
                  <TemplateCard
                    key={tpl.name}
                    tpl={tpl}
                    isZh={isZh}
                    onUse={() => useTemplate(tpl)}
                    label={t("useTemplate")}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Detail View ───────────────────────────────────────────── */}
      {view === "detail" && selectedTopic && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isZh && selectedTopic.nameZh
                ? selectedTopic.nameZh
                : selectedTopic.name}
            </h2>
            {selectedTopic.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {selectedTopic.description}
              </p>
            )}

            {/* Keywords */}
            <div className="flex flex-wrap gap-2 mt-3">
              {(JSON.parse(selectedTopic.keywords) as string[]).map(
                (kw) => (
                  <span
                    key={kw}
                    className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded-full"
                  >
                    {kw}
                  </span>
                ),
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {xAccounts.length > 1 && (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {xAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      @{acc.username || acc.label || acc.id}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {analyzing ? t("analyzing") : t("analyze")}
              </button>
            </div>
          </div>

          {/* Snapshot history */}
          {selectedTopic.snapshots.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                {t("snapshots")} ({selectedTopic.snapshots.length})
              </h3>

              {/* Trend chart if multiple snapshots */}
              {selectedTopic.snapshots.length > 1 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t("trendOverTime")}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={[...selectedTopic.snapshots]
                        .reverse()
                        .map((s) => ({
                          date: new Date(
                            s.createdAt,
                          ).toLocaleDateString(),
                          [isZh ? "正面" : "Positive"]:
                            s.positiveCount,
                          [isZh ? "负面" : "Negative"]:
                            s.negativeCount,
                          [isZh ? "中立" : "Neutral"]:
                            s.neutralCount,
                        }))}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#374151"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        stroke="#6b7280"
                      />
                      <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={isZh ? "正面" : "Positive"}
                        stroke={SENTIMENT_COLORS.positive}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={isZh ? "负面" : "Negative"}
                        stroke={SENTIMENT_COLORS.negative}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={isZh ? "中立" : "Neutral"}
                        stroke={SENTIMENT_COLORS.neutral}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Snapshot list */}
              <div className="space-y-2">
                {selectedTopic.snapshots.map((snap) => (
                  <button
                    key={snap.id}
                    onClick={() => {
                      setSelectedSnapshot(snap);
                      setView("result");
                    }}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {new Date(snap.createdAt).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {t("tweetCount", { count: snap.tweetCount })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <SentimentBar
                        p={snap.positiveCount}
                        ne={snap.negativeCount}
                        nu={snap.neutralCount}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Result View ───────────────────────────────────────────── */}
      {view === "result" && selectedSnapshot && (
        <ResultView snapshot={selectedSnapshot} isZh={isZh} t={t} />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TemplateCard({
  tpl,
  isZh,
  onUse,
  label,
}: {
  tpl: DemoTemplate;
  isZh: boolean;
  onUse: () => void;
  label: string;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        {isZh ? tpl.nameZh : tpl.name}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {isZh ? tpl.descriptionZh : tpl.description}
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {tpl.keywords.slice(0, 3).map((kw) => (
          <span
            key={kw}
            className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] rounded"
          >
            {kw}
          </span>
        ))}
        {tpl.keywords.length > 3 && (
          <span className="text-[10px] text-gray-400">
            +{tpl.keywords.length - 3}
          </span>
        )}
      </div>
      <button
        onClick={onUse}
        className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        {label}
      </button>
    </div>
  );
}

function SentimentBar({
  p,
  ne,
  nu,
}: {
  p: number;
  ne: number;
  nu: number;
}) {
  const total = p + ne + nu || 1;
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
      <div
        className="bg-green-500"
        style={{ width: `${(p / total) * 100}%` }}
      />
      <div
        className="bg-gray-400"
        style={{ width: `${(nu / total) * 100}%` }}
      />
      <div
        className="bg-red-500"
        style={{ width: `${(ne / total) * 100}%` }}
      />
    </div>
  );
}

function ResultView({
  snapshot,
  isZh,
  t,
}: {
  snapshot: Snapshot;
  isZh: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}) {
  const themes: string[] = snapshot.themes ? JSON.parse(snapshot.themes) : [];
  const topTweets: Array<{
    id: string;
    text: string;
    authorUsername: string;
    sentiment: string;
    likeCount?: number;
    retweetCount?: number;
  }> = snapshot.topTweets ? JSON.parse(snapshot.topTweets) : [];

  const pieData = [
    { name: t("positive"), value: snapshot.positiveCount },
    { name: t("neutral"), value: snapshot.neutralCount },
    { name: t("negative"), value: snapshot.negativeCount },
  ];

  const sentimentLabel = isZh
    ? ["正面", "中立", "负面"]
    : ["Positive", "Neutral", "Negative"];
  const sentimentBg: Record<string, string> = {
    positive:
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    negative:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    neutral:
      "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  };

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={t("tweetCount", { count: snapshot.tweetCount })}
          value={String(snapshot.tweetCount)}
          color="blue"
        />
        <StatCard
          label={sentimentLabel[0]}
          value={`${snapshot.positiveCount}%`}
          color="green"
        />
        <StatCard
          label={sentimentLabel[1]}
          value={`${snapshot.neutralCount}%`}
          color="gray"
        />
        <StatCard
          label={sentimentLabel[2]}
          value={`${snapshot.negativeCount}%`}
          color="red"
        />
      </div>

      {/* Pie chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t("sentiment")}
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={90}
              dataKey="value"
              label={({ name, value }) => `${name} ${value}%`}
              labelLine={false}
            >
              <Cell fill={SENTIMENT_COLORS.positive} />
              <Cell fill={SENTIMENT_COLORS.neutral} />
              <Cell fill={SENTIMENT_COLORS.negative} />
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Themes */}
      {themes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("themes")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <span
                key={theme}
                className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm rounded-full"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {snapshot.aiSummary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("aiSummary")}
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {snapshot.aiSummary}
          </div>
        </div>
      )}

      {/* Top Tweets */}
      {topTweets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            {t("topTweets")}
          </h3>
          <div className="space-y-3">
            {topTweets.map((tweet) => (
              <div
                key={tweet.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    @{tweet.authorUsername}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${sentimentBg[tweet.sentiment] || sentimentBg.neutral}`}
                  >
                    {tweet.sentiment === "positive"
                      ? sentimentLabel[0]
                      : tweet.sentiment === "negative"
                        ? sentimentLabel[2]
                        : sentimentLabel[1]}
                  </span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {tweet.text}
                </p>
                {(tweet.likeCount || tweet.retweetCount) && (
                  <div className="mt-1 text-xs text-gray-400">
                    {tweet.likeCount ? `❤️ ${tweet.likeCount}` : ""}{" "}
                    {tweet.retweetCount
                      ? `🔁 ${tweet.retweetCount}`
                      : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-400 text-center">
        {new Date(snapshot.createdAt).toLocaleString()}
        {snapshot.modelId && ` · ${snapshot.modelId}`}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    red: "text-red-600 dark:text-red-400",
    gray: "text-gray-600 dark:text-gray-400",
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
      <div className={`text-xl font-bold ${colors[color] || colors.blue}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}
