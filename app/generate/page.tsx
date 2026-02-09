"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [language, setLanguage] = useState("auto");

  const charCount = generatedContent.length;
  const charRemaining = 280 - charCount;

  const handleGenerate = async (multiple: boolean = false) => {
    setError("");
    setSuccess("");
    setIsGenerating(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt || undefined,
          multiple,
          language: language === "auto" ? undefined : language,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate content");
      }

      if (multiple && data.suggestions) {
        setSuggestions(data.suggestions);
        setGeneratedContent("");
      } else if (data.content) {
        setGeneratedContent(data.content);
        setSuggestions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectSuggestion = (content: string) => {
    setGeneratedContent(content);
    setSuggestions([]);
  };

  const handlePostNow = async () => {
    if (!generatedContent.trim()) {
      setError("No content to post");
      return;
    }

    setIsPosting(true);
    setError("");

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: generatedContent,
          postImmediately: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to post");
      }

      if (data.status === "posted") {
        setSuccess("Posted successfully!");
        setGeneratedContent("");
        setTimeout(() => router.push("/"), 1500);
      } else {
        throw new Error(data.error || "Post failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = () => {
    if (!generatedContent.trim()) return;
    // Navigate to schedule page with content pre-filled
    router.push(`/schedule?content=${encodeURIComponent(generatedContent)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Content Generator
            </h1>
            <Link
              href="/"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Generation Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generate Tweet
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              AI will use your knowledge base to generate relevant content
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Topic or Prompt (optional)
                </label>
                <input
                  type="text"
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., new product features, company news..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="language"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="English">English</option>
                  <option value="Chinese">中文 (Chinese)</option>
                  <option value="Japanese">日本語 (Japanese)</option>
                  <option value="Korean">한국어 (Korean)</option>
                  <option value="Spanish">Español (Spanish)</option>
                  <option value="French">Français (French)</option>
                  <option value="German">Deutsch (German)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => handleGenerate(false)}
                disabled={isGenerating}
                className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? "Generating..." : "Generate Tweet"}
              </button>
              <button
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="flex-1 px-6 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? "Generating..." : "Get 3 Suggestions"}
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Choose a Suggestion
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <p className="text-gray-900 dark:text-white">{suggestion}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {suggestion.length} characters
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generated Content Editor */}
        {(generatedContent || suggestions.length === 0) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {generatedContent ? "Edit & Post" : "Generated Content"}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <textarea
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  rows={4}
                  placeholder="Generated content will appear here. You can also type directly..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                />
                <div className="mt-2 flex justify-between items-center">
                  <span
                    className={`text-sm ${
                      charRemaining < 0
                        ? "text-red-500"
                        : charRemaining < 20
                        ? "text-yellow-500"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {charRemaining} characters remaining
                  </span>
                  {generatedContent && (
                    <button
                      onClick={() => handleGenerate(false)}
                      disabled={isGenerating}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-green-600 dark:text-green-400 text-sm">
                    {success}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handlePostNow}
                  disabled={
                    !generatedContent.trim() ||
                    charCount > 280 ||
                    isPosting
                  }
                  className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPosting ? "Posting..." : "Post Now"}
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!generatedContent.trim() || charCount > 280}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Edit & Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Knowledge Base Link */}
        <div className="mt-6 text-center">
          <Link
            href="/knowledge"
            className="text-sm text-blue-600 hover:underline"
          >
            Manage Knowledge Base Sources →
          </Link>
        </div>
      </main>
    </div>
  );
}
