"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Segment {
  index: number;
  status: "queued" | "generating" | "completed" | "failed";
  outputUrl: string | null;
  error: string | null;
  taskId: string | null;
}

interface VideoJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "partial";
  prompt: string;
  modelLabel: string;
  modelId: string;
  videoMode: "t2v" | "i2v";
  i2vImageUrl: string | null;
  segmentCount: number;
  segments: Segment[];
  completedUrls: string[];
  stitchedUrl: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export default function VideoJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "processing" | "completed" | "partial" | "failed"
  >("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [now, setNow] = useState(new Date());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Update time every second for live ETA calculations
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  // Extract the inner raw blob URL from a proxy URL, to compare across polls
  const extractInnerUrl = (url: string): string => {
    if (url.includes("/api/toolbox/blob-proxy")) {
      try {
        const inner = new URL(url).searchParams.get("u");
        if (inner) return inner;
      } catch {}
    }
    return url;
  };

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);
      params.append("limit", "50");

      const res = await fetch(`/api/toolbox/video/long-gen/jobs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch jobs");
      const data = await res.json();

      // Preserve existing stitchedUrl when the underlying blob URL hasn't changed,
      // to prevent the video element from reloading on every poll cycle.
      setJobs((prevJobs) =>
        data.jobs.map((newJob: VideoJob) => {
          const existing = prevJobs.find((j) => j.id === newJob.id);
          if (existing?.stitchedUrl && newJob.stitchedUrl) {
            const oldInner = extractInnerUrl(existing.stitchedUrl);
            const newInner = extractInnerUrl(newJob.stitchedUrl);
            if (oldInner === newInner) {
              return { ...newJob, stitchedUrl: existing.stitchedUrl };
            }
          }
          return newJob;
        }),
      );
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/toolbox/video/long-gen/process-now", {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ Processing triggered! ${data.message}`);
        // Refresh jobs immediately
        await fetchJobs();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Failed to trigger processing");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleRetrySegment = async (jobId: string, segmentIndex: number) => {
    try {
      const res = await fetch(`/api/toolbox/video/long-gen/${jobId}/retry-segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmentIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchJobs();
      } else {
        alert(`❌ ${data.error}`);
      }
    } catch (error) {
      alert("❌ Request failed");
      console.error(error);
    }
  };

  const handleStitchJob = async (jobId: string) => {
    try {
      if (!confirm("Start stitching process for this job?")) return;

      const res = await fetch(`/api/toolbox/video/long-gen/${jobId}/stitch`, {
        method: "POST",
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Stitching started successfully!");
        await fetchJobs();
      } else {
        alert(`❌ Stitching failed: ${data.error}`);
      }
    } catch (error) {
      alert("❌ Request failed");
      console.error(error);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/toolbox/video/long-gen/${jobId}/retry`, {
        method: "POST",
      });

      console.log("Retry response status:", res.status, res.statusText);

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error("Failed to parse response JSON:", parseError);
        const text = await res.text();
        alert(`❌ Server error (${res.status}):\n\n${text}`);
        return;
      }

      if (res.ok) {
        alert(`✅ Job retry started! Processing segments now...`);
        await fetchJobs();
      } else {
        // Display error with reason if available
        const errorMessage = data.error || "Unknown error";
        const reason = data.reason || "";
        const fullMessage = reason
          ? `${errorMessage}\n\n${reason}`
          : errorMessage;
        alert(`❌ Retry failed:\n\n${fullMessage}`);
        console.error("Retry error response:", data);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`❌ Failed to retry job:\n\n${errorMsg}`);
      console.error("Retry error:", error);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Auto-refresh every 5 seconds if enabled
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [filter, autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "processing":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "partial":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getSegmentStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      case "generating":
        return "⏳";
      case "queued":
        return "⏷️";
      default:
        return "•";
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTimeStats = (job: VideoJob) => {
    if (!job.startedAt) return null;

    const startTime = new Date(job.startedAt).getTime();
    const endTime = job.completedAt
      ? new Date(job.completedAt).getTime()
      : now.getTime();
    const elapsedMs = endTime - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    const completedCount = job.segments.filter(
      (s) => s.status === "completed",
    ).length;

    if (completedCount === 0) {
      return {
        elapsedSeconds,
        avgPerSegment: null,
        estimatedTotal: null,
        remaining: null,
      };
    }

    const avgPerSegment = Math.floor(elapsedMs / completedCount / 1000);
    const estimatedTotal = avgPerSegment * job.segmentCount;
    const remaining = Math.max(0, estimatedTotal - elapsedSeconds);

    return { elapsedSeconds, avgPerSegment, estimatedTotal, remaining };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Video Generation Jobs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your long-video generation tasks
            </p>
          </div>
          <Link
            href="/toolbox"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ← Back to Toolbox
          </Link>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6 flex-wrap items-center">
          <div className="flex gap-2 flex-wrap">
            {(
              [
                "all",
                "pending",
                "processing",
                "completed",
                "partial",
                "failed",
              ] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <button
            onClick={handleProcessNow}
            disabled={processing}
            className="px-4 py-1 rounded-full text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 transition ml-auto"
          >
            {processing ? "⏳ Processing..." : "▶️ Process Now"}
          </button>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Auto-refresh
            </span>
          </label>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">⏳</div>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Loading jobs...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && jobs.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">
              No video generation jobs found
            </p>
            <Link
              href="/toolbox"
              className="text-blue-600 dark:text-blue-400 hover:underline mt-2"
            >
              Start generating →
            </Link>
          </div>
        )}

        {/* Jobs Grid */}
        {!loading && jobs.length > 0 && (
          <div className="space-y-4">
            {jobs.map((job) => {
              const completedCount = job.segments.filter(
                (s) => s.status === "completed",
              ).length;
              const failedCount = job.segments.filter(
                (s) => s.status === "failed",
              ).length;
              const progress = Math.round(
                (completedCount / job.segmentCount) * 100,
              );
              const timeStats = getTimeStats(job);

              return (
                <div
                  key={job.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition"
                >
                  {/* Top Section */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {job.prompt}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            job.status,
                          )}`}
                        >
                          {job.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Model:{" "}
                        <span className="font-medium">{job.modelLabel}</span> •
                        Job ID:{" "}
                        <code className="text-xs">{job.id.slice(0, 8)}</code>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Created {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar & Time Stats */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Progress: {completedCount}/{job.segmentCount} segments
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {/* Time Stats */}
                    {job.status === "processing" && timeStats && (
                      <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                          <div className="text-gray-600 dark:text-gray-400">
                            Elapsed
                          </div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {formatDuration(timeStats.elapsedSeconds)}
                          </div>
                        </div>
                        {timeStats.avgPerSegment && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                            <div className="text-gray-600 dark:text-gray-400">
                              Avg/Segment
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatDuration(timeStats.avgPerSegment)}
                            </div>
                          </div>
                        )}
                        {timeStats.remaining !== null && (
                          <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                            <div className="text-gray-600 dark:text-gray-400">
                              Est. Remaining
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {formatDuration(timeStats.remaining)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {job.status === "completed" &&
                      job.startedAt &&
                      job.completedAt && (
                        <div className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded mb-3">
                          ✅ Completed in{" "}
                          {formatDuration(
                            Math.floor(
                              (new Date(job.completedAt).getTime() -
                                new Date(job.startedAt).getTime()) /
                                1000,
                            ),
                          )}
                        </div>
                      )}

                    {failedCount > 0 && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        ⚠️ {failedCount} segment{failedCount !== 1 ? "s" : ""}{" "}
                        failed
                      </p>
                    )}
                  </div>

                  {/* Segments */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Segments ({job.segments?.length || 0}):
                    </p>
                    {job.segments?.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No segments initialized
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {job.segments?.map((seg) => (
                          <div
                            key={seg.index}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">
                                {getSegmentStatusIcon(seg.status)}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  seg.status === "completed"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    : seg.status === "failed"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : seg.status === "generating"
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                }`}
                              >
                                Segment {seg.index}
                              </span>
                              {(seg.status === "generating" || seg.status === "failed") && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetrySegment(job.id, seg.index);
                                  }}
                                  className="ml-auto text-xs px-2 py-1 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded hover:bg-orange-200 dark:hover:bg-orange-900/50 transition"
                                  title="强制重新生成此片段"
                                >
                                  ↺ 重新生成
                                </button>
                              )}
                            </div>

                            {seg.outputUrl && seg.status === "completed" && (
                              <video
                                src={seg.outputUrl}
                                className="w-full rounded-lg bg-black mb-2"
                                controls
                                style={{ maxHeight: "300px" }}
                              />
                            )}

                            {seg.outputUrl && seg.status !== "completed" && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 p-2 rounded mb-2">
                                Video URL:{" "}
                                <a
                                  href={seg.outputUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                                >
                                  {seg.outputUrl}
                                </a>
                              </div>
                            )}

                            {!seg.outputUrl && seg.status === "completed" && (
                              <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded mb-2">
                                ⚠️ Marked completed but no video URL
                              </div>
                            )}

                            {seg.error && (
                              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                Error: {seg.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stitched Result */}
                  {job.stitchedUrl && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-800 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-bold text-purple-900 dark:text-purple-300">
                          🎬 Stitched Video Ready
                        </p>
                        <a
                          href={job.stitchedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition"
                        >
                          Download / View
                        </a>
                      </div>
                      <video
                        src={job.stitchedUrl}
                        controls
                        className="w-full rounded bg-black max-h-48"
                      />
                    </div>
                  )}

                  {/* Manual Stitch Button (Card View) */}
                  {!job.stitchedUrl && job.completedUrls.length >= 2 && (
                    <div className="mb-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStitchJob(job.id);
                        }}
                        className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition flex items-center justify-center gap-2"
                      >
                        ✂️ Stitch {job.completedUrls.length} Segments Now
                      </button>
                    </div>
                  )}

                  {/* Results */}
                  {job.completedUrls.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Completed Videos ({job.completedUrls.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {job.completedUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs hover:underline"
                          >
                            Video {idx + 1} 🔗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Error/Warning Message */}
                  {job.error && job.status === "failed" && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs">
                      ❌ Error: {job.error}
                    </div>
                  )}

                  {job.error &&
                    (job.status === "completed" ||
                      job.status === "partial") && (
                      <div className="mb-4 p-3 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded text-xs">
                        ⚠️ {job.error}
                      </div>
                    )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setSelectedJobId(job.id)}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                    >
                      📋 View Full Details
                    </button>

                    <a
                      href={`/api/toolbox/video/long-gen/${job.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Details (API)
                    </a>

                    {job.status !== "pending" &&
                      job.status !== "processing" && (
                        <button
                          onClick={() => handleRetryJob(job.id)}
                          className="text-xs text-orange-600 dark:text-orange-400 hover:underline ml-auto"
                        >
                          🔄 Retry Job
                        </button>
                      )}

                    {job.completedAt && (
                      <span className="text-xs text-gray-500 dark:text-gray-500 ml-auto">
                        Completed {new Date(job.completedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedJobId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Job Details
              </h2>
              <button
                onClick={() => setSelectedJobId(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {jobs
                .filter((j) => j.id === selectedJobId)
                .map((job) => {
                  const isI2vMissingImage =
                    job.videoMode === "i2v" && !job.i2vImageUrl;
                  return (
                    <div key={job.id} className="space-y-6">
                      {isI2vMissingImage && (
                        <div className="p-4 bg-red-100 border border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300 rounded-lg">
                          <p className="font-semibold mb-1">
                            ⚠️ Missing Image for I2V Model
                          </p>
                          <p className="text-sm mb-3">
                            This job uses an image-to-video (I2V) model but was
                            submitted without an image URL. This is why it
                            failed.
                          </p>
                          <p className="text-sm">
                            Please go back to the toolbox and resubmit with an
                            image.
                          </p>
                        </div>
                      )}

                      {/* Manual Stitch Button */}
                      {!job.stitchedUrl && job.completedUrls.length >= 2 && (
                        <div className="p-4 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800 rounded-lg flex items-center justify-between">
                          <p className="text-sm text-green-800 dark:text-green-300">
                            <strong>
                              {job.completedUrls.length} segments ready!
                            </strong>{" "}
                            You can manually stitch them now.
                          </p>
                          <button
                            onClick={() => handleStitchJob(job.id)}
                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition"
                          >
                            ✂️ Stitch Videos
                          </button>
                        </div>
                      )}

                      {/* Job Metadata */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Job Metadata
                        </h3>
                        <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-auto max-h-64 text-gray-800 dark:text-gray-200">
                          {JSON.stringify(
                            {
                              id: job.id,
                              status: job.status,
                              prompt: job.prompt,
                              modelLabel: job.modelLabel,
                              modelId: job.modelId,
                              videoMode: job.videoMode,
                              i2vImageUrl: job.i2vImageUrl,
                              segmentCount: job.segmentCount,
                              createdAt: job.createdAt,
                              startedAt: job.startedAt,
                              completedAt: job.completedAt,
                              error: job.error,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>

                      {/* Segments Detail */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Segment Details ({job.segments.length})
                        </h3>
                        <div className="space-y-3">
                          {job.segments.map((seg, idx) => (
                            <div
                              key={idx}
                              className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-gray-50 dark:bg-gray-900/50"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-mono text-sm font-bold">
                                  Segment {seg.index}
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    seg.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : seg.status === "failed"
                                        ? "bg-red-100 text-red-700"
                                        : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {seg.status}
                                </span>
                              </div>
                              <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 overflow-auto max-h-48 text-gray-700 dark:text-gray-300">
                                {JSON.stringify(seg, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Completed URLs */}
                      {job.completedUrls.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Completed URLs
                          </h3>
                          <div className="space-y-2">
                            {job.completedUrls.map((url, idx) => (
                              <div
                                key={idx}
                                className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs break-all"
                              >
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
