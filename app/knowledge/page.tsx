"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";

interface KnowledgeSource {
  id: string;
  url: string;
  name: string;
  content: string;
  pagesScraped: number;
  lastScraped: string | null;
  isActive: boolean;
  createdAt: string;
  images?: { id: string; blobUrl: string; altText: string | null }[];
  _count?: { images: number };
}

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rescraping, setRescraping] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    const res = await fetch("/api/knowledge");
    const data = await res.json();
    setSources(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!url.trim() || !name.trim()) {
      setError("Please enter both URL and name");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add source");
      }

      setUrl("");
      setName("");
      fetchSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
    } finally {
      setRescraping(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;

    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    fetchSources();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Knowledge Base
            </h1>
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add New Source */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Add Website Source
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Add websites to build your knowledge base for AI content
              generation
            </p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Source Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Company Website"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Website URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Adding..." : "Add Source"}
              </button>
            </div>
          </form>
        </div>

        {/* Sources List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Sources ({sources.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : sources.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No sources yet. Add a website above to get started!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sources.map((source) => (
                <div key={source.id} className="px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {source.name}
                        </h3>
                        {!source.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {source.url}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {source.lastScraped
                          ? `Last scraped: ${format(
                              new Date(source.lastScraped),
                              "PPp"
                            )}`
                          : "Never scraped"}{" "}
                        | {source.pagesScraped} page{source.pagesScraped !== 1 ? "s" : ""} | {source.content.length.toLocaleString()} chars |{" "}
                        {source._count?.images ?? source.images?.length ?? 0} images
                      </p>
                      {source.images && source.images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {source.images.slice(0, 4).map((img) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={img.id}
                              src={img.blobUrl}
                              alt={img.altText || source.name}
                              className="h-12 w-12 rounded border border-gray-200 dark:border-gray-700 object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggle(source.id, source.isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          source.isActive
                            ? "bg-blue-600"
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            source.isActive ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleRescrape(source.id)}
                        disabled={rescraping === source.id}
                        className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                      >
                        {rescraping === source.id ? "Scraping..." : "Refresh"}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === source.id ? null : source.id
                          )
                        }
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        {expandedId === source.id ? "Hide" : "View"}
                      </button>
                      <button
                        onClick={() => handleDelete(source.id)}
                        className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {expandedId === source.id && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Scraped Content Preview
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-60 overflow-y-auto">
                        {source.content.substring(0, 2000)}
                        {source.content.length > 2000 && "..."}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
