"use client";

import { useEffect, useState } from "react";

interface Trend {
  name: string;
  url?: string;
  description?: string;
}

const REGIONS = [
  { key: "global", label: "🌍 Global" },
  { key: "usa", label: "🇺🇸 USA" },
  { key: "china", label: "🇨🇳 China" },
  { key: "africa", label: "🌍 Africa" },
] as const;

type RegionKey = (typeof REGIONS)[number]["key"];

export default function TestTrendsPage() {
  const [region, setRegion] = useState<RegionKey>("global");
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timestamp, setTimestamp] = useState("");

  const fetchTrends = async (r: RegionKey) => {
    setLoading(true);
    setError("");
    setTrends([]);
    try {
      const res = await fetch(`/api/trending/test?region=${r}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setTrends(data.trends ?? []);
        setTimestamp(data.timestamp ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTrends("global");
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          🔥 Trending News Test
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Internal test page — GNews API + newsapi.ai live data
        </p>
      </div>

      {/* Region selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {REGIONS.map((r) => (
          <button
            key={r.key}
            onClick={() => {
              setRegion(r.key);
              void fetchTrends(r.key);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              region === r.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => void fetchTrends(region)}
          className="px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Status */}
      {timestamp && (
        <p className="text-xs text-gray-400 mb-4">
          Fetched at: {new Date(timestamp).toLocaleString()}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      )}

      {/* Results */}
      {!loading && trends.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
            {trends.length} articles fetched
          </p>
          {trends.map((t, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-gray-400 mt-0.5 w-5 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white text-sm leading-snug">
                    {t.name}
                  </p>
                  {t.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t.description}
                    </p>
                  )}
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
                    >
                      View source ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && trends.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No results. Check API keys in .env.local
        </div>
      )}
    </div>
  );
}
