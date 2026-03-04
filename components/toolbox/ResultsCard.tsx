import { useRef } from "react";
import type { Tab, TaskStatus, SaveStatus, StudioModel, LongVideoSegment } from "./constants";

interface ResultsCardProps {
  tab: Tab;
  status: TaskStatus;
  isRunning: boolean;
  error: string;
  elapsed: number;
  taskId: string | null;
  outputUrl: string | null;
  selectedModel: StudioModel;
  enableLongVideo: boolean;
  prefix: string;
  isZh: boolean;
  // Save
  saveStatus: SaveStatus;
  saveError: string;
  savedBlobUrl: string | null;
  // Long video
  longVideoSegments: LongVideoSegment[];
  isStitching: boolean;
  stitchProgress: { current: number; total: number } | null;
  stitchedVideoUrl: string | null;
  // Audio mixing
  audioMode: "voiceover" | "bgm" | "both" | null;
  voiceoverText: string;
  ttsVoice: string;
  voiceoverVolume: number;
  bgmSource: "upload" | "ai";
  bgmFile: File | null;
  bgmVolume: number;
  bgmPrompt: string;
  bgmAudioUrl: string | null;
  isGeneratingBgm: boolean;
  isMixing: boolean;
  isTtsPreviewing: boolean;
  ttsPreviewUrl: string | null;
  mixedVideoUrl: string | null;
  audioError: string;
  // Callbacks
  onReset: () => void;
  onMakeVideo: () => void;
  onStitch: () => void;
  onMixAudio: () => void;
  onTtsPreview: () => void;
  onGenerateBgm: () => void;
  onSetAudioMode: (mode: "voiceover" | "bgm" | "both" | null) => void;
  onSetVoiceoverText: (text: string) => void;
  onSetTtsVoice: (voice: string) => void;
  onSetVoiceoverVolume: (vol: number) => void;
  onSetBgmSource: (src: "upload" | "ai") => void;
  onSetBgmFile: (file: File | null) => void;
  onSetBgmVolume: (vol: number) => void;
  onSetBgmPrompt: (prompt: string) => void;
}

export default function ResultsCard({
  tab,
  status,
  isRunning,
  error,
  elapsed,
  taskId,
  outputUrl,
  selectedModel,
  enableLongVideo,
  prefix,
  isZh,
  saveStatus,
  saveError,
  savedBlobUrl,
  longVideoSegments,
  isStitching,
  stitchProgress,
  stitchedVideoUrl,
  audioMode,
  voiceoverText,
  ttsVoice,
  voiceoverVolume,
  bgmSource,
  bgmFile,
  bgmVolume,
  bgmPrompt,
  bgmAudioUrl,
  isGeneratingBgm,
  isMixing,
  isTtsPreviewing,
  ttsPreviewUrl,
  mixedVideoUrl,
  audioError,
  onReset,
  onMakeVideo,
  onStitch,
  onMixAudio,
  onTtsPreview,
  onGenerateBgm,
  onSetAudioMode,
  onSetVoiceoverText,
  onSetTtsVoice,
  onSetVoiceoverVolume,
  onSetBgmSource,
  onSetBgmFile,
  onSetBgmVolume,
  onSetBgmPrompt,
}: ResultsCardProps) {
  const bgmFileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {status === "completed"
              ? tab === "image"
                ? "图片生成完成"
                : "Video Ready"
              : status === "failed"
                ? "Generation Failed"
                : tab === "image"
                  ? "生成中…"
                  : "Generating…"}
          </h2>
          {saveStatus === "saving" && (
            <span className="text-xs text-gray-400">保存中…</span>
          )}
          {saveStatus === "saved" && (
            <a
              href={`${prefix}/gallery`}
              className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full hover:underline"
            >
              已保存到 Gallery ✓
            </a>
          )}
          {saveStatus === "error" && (
            <span className="text-xs text-red-400">
              保存失败{saveError ? `：${saveError}` : ""}
            </span>
          )}
        </div>
        {(status === "completed" || status === "failed") && (
          <button
            onClick={onReset}
            className="text-sm text-blue-600 hover:underline"
          >
            {tab === "image" ? "再生成一张" : "New video"}
          </button>
        )}
      </div>
      <div className="p-6">
        {/* Loading state */}
        {isRunning && (
          <div className="flex flex-col items-center gap-4 py-6">
            <svg
              className="w-14 h-14 animate-spin text-purple-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                {tab === "image"
                  ? `使用 ${selectedModel.label} 生成图片…`
                  : `Generating with ${selectedModel.label}…`}
              </p>
              {tab === "video" && taskId && (
                <p className="text-xs text-gray-400 mt-1">Task: {taskId}</p>
              )}
              {elapsed > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {elapsed}s
                  {tab === "video"
                    ? " — video generation typically takes 1–3 minutes"
                    : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "failed" && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Image result */}
        {status === "completed" && outputUrl && tab === "image" && (
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outputUrl}
              alt="Generated image"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[70vh] object-contain mx-auto"
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={outputUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                Download
              </a>
              <a
                href={`${prefix}/schedule?mediaUrl=${encodeURIComponent(savedBlobUrl ?? outputUrl)}`}
                className="flex-1 text-center py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Use in Post
              </a>
              <button
                onClick={onMakeVideo}
                className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Make Video
              </button>
              <button
                onClick={onReset}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Regenerate
              </button>
            </div>
            {elapsed > 0 && (
              <p className="text-xs text-center text-gray-400">
                用时 {elapsed}s · {selectedModel.label}
              </p>
            )}
          </div>
        )}

        {/* Single video result */}
        {status === "completed" &&
          outputUrl &&
          tab === "video" &&
          !enableLongVideo && (
            <div className="space-y-4">
              <video
                key={outputUrl}
                src={outputUrl}
                controls
                autoPlay
                loop
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] mx-auto"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={outputUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Download Video
                </a>
                <button
                  onClick={onReset}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  Generate Another
                </button>
              </div>
              {elapsed > 0 && (
                <p className="text-xs text-center text-gray-400">
                  Generated in {elapsed}s using {selectedModel.label}
                </p>
              )}
            </div>
          )}

        {/* Long video segments */}
        {tab === "video" && longVideoSegments.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Long Video Segments
                </h3>
                <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                  {
                    longVideoSegments.filter((s) => s.status === "completed")
                      .length
                  }
                  /{longVideoSegments.length} completed
                </span>
              </div>
              {isStitching && stitchProgress ? (
                <div className="flex items-center gap-2 min-w-35">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((stitchProgress.current / stitchProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {stitchProgress.current}/{stitchProgress.total}
                  </span>
                </div>
              ) : (
                <button
                  onClick={onStitch}
                  disabled={
                    isStitching ||
                    longVideoSegments.filter((s) => s.status === "completed")
                      .length < 2
                  }
                  className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white disabled:opacity-50"
                >
                  Stitch Segments
                </button>
              )}
            </div>
            <div className="space-y-2">
              {longVideoSegments.map((segment) => (
                <div
                  key={segment.index}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-gray-700 dark:text-gray-200">
                      Segment {segment.index}
                    </p>
                    <p
                      className={`text-xs ${
                        segment.status === "completed"
                          ? "text-green-600"
                          : segment.status === "failed"
                            ? "text-red-500"
                            : segment.status === "generating"
                              ? "text-blue-500"
                              : "text-gray-400"
                      }`}
                    >
                      {segment.status}
                    </p>
                  </div>
                  {segment.taskId && (
                    <p className="text-xs text-gray-400 mt-1">
                      Task: {segment.taskId}
                    </p>
                  )}
                  {segment.outputUrl && (
                    <a
                      href={segment.outputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Open segment video
                    </a>
                  )}
                  {segment.error && (
                    <p className="text-xs text-red-500 mt-1">
                      {segment.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stitched video */}
        {(stitchedVideoUrl || isStitching) && tab === "video" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                长视频
              </h3>
              {isStitching && stitchProgress && (
                <div className="flex items-center gap-2 flex-1 ml-4">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.round((stitchProgress.current / stitchProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                    {Math.round(
                      (stitchProgress.current / stitchProgress.total) * 100,
                    )}
                    % （{stitchProgress.current}/{stitchProgress.total} 段）
                  </span>
                </div>
              )}
            </div>
            {isStitching && !stitchProgress && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                合并中，请稍等…
              </p>
            )}
            {!isStitching &&
              !stitchedVideoUrl &&
              longVideoSegments.some((s) => s.status === "completed") && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  合并失败，可在下方手动合并各段。
                </p>
              )}
            {!isStitching && stitchedVideoUrl && (
              <>
                <video
                  key={stitchedVideoUrl}
                  src={stitchedVideoUrl}
                  controls
                  autoPlay
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh] mx-auto"
                />
                <a
                  href={stitchedVideoUrl}
                  download="long-video.webm"
                  className="inline-flex text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  下载长视频
                </a>
              </>
            )}
          </div>
        )}

        {/* Audio mixing panel */}
        {tab === "video" &&
          (stitchedVideoUrl || (outputUrl && status === "completed")) && (
            <div className="mt-6 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  onSetAudioMode(audioMode ? null : "voiceover")
                }
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750"
              >
                <span>🎙 添加旁白 / 背景音乐</span>
                <span className="text-gray-400">
                  {audioMode ? "▲" : "▼"}
                </span>
              </button>

              {audioMode && (
                <div className="p-4 space-y-4">
                  {/* Mode selector */}
                  <div className="flex gap-2">
                    {(["voiceover", "bgm", "both"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSetAudioMode(m)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          audioMode === m
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {m === "voiceover"
                          ? "🎙 旁白"
                          : m === "bgm"
                            ? "🎵 背景音乐"
                            : "两者都加"}
                      </button>
                    ))}
                  </div>

                  {/* Voiceover section */}
                  {(audioMode === "voiceover" || audioMode === "both") && (
                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        旁白文本
                      </label>
                      <textarea
                        value={voiceoverText}
                        onChange={(e) => onSetVoiceoverText(e.target.value)}
                        rows={3}
                        placeholder="输入旁白内容，支持中英文（最多 4096 字）…"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                      />
                      <div className="flex flex-wrap gap-3 items-center">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            音色
                          </label>
                          <div className="flex items-center gap-2">
                            <select
                              value={ttsVoice}
                              onChange={(e) => {
                                onSetTtsVoice(e.target.value);
                              }}
                              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 dark:bg-gray-700 dark:text-white"
                            >
                              {(
                                [
                                  "nova",
                                  "shimmer",
                                  "alloy",
                                  "echo",
                                  "fable",
                                  "onyx",
                                ] as const
                              ).map((v) => (
                                <option key={v} value={v}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={onTtsPreview}
                              disabled={isTtsPreviewing}
                              className="text-xs px-2 py-1 rounded border border-purple-400 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                            >
                              {isTtsPreviewing ? "生成中…" : "试听"}
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-30">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            旁白音量 {voiceoverVolume}%
                          </label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={voiceoverVolume}
                            onChange={(e) =>
                              onSetVoiceoverVolume(Number(e.target.value))
                            }
                            className="w-full"
                          />
                        </div>
                      </div>
                      {ttsPreviewUrl && (
                        <audio
                          key={ttsPreviewUrl}
                          src={ttsPreviewUrl}
                          controls
                          autoPlay
                          className="w-full mt-1"
                        />
                      )}
                    </div>
                  )}

                  {/* BGM section */}
                  {(audioMode === "bgm" || audioMode === "both") && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          背景音乐
                        </label>
                        <div className="flex gap-1">
                          {(["ai", "upload"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => onSetBgmSource(s)}
                              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                                bgmSource === s
                                  ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                                  : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {s === "ai" ? "🎵 AI 生成" : "📁 上传文件"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {bgmSource === "ai" ? (
                        <div className="space-y-2">
                          <textarea
                            value={bgmPrompt}
                            onChange={(e) => onSetBgmPrompt(e.target.value)}
                            rows={2}
                            placeholder="描述音乐风格，例如：轻柔钢琴背景音乐，舒缓温暖，无人声…"
                            className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none"
                          />
                          <button
                            type="button"
                            onClick={onGenerateBgm}
                            disabled={isGeneratingBgm}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isGeneratingBgm
                              ? "AI 生成中…"
                              : bgmAudioUrl
                                ? "重新生成"
                                : "AI 生成背景音乐"}
                          </button>
                          {bgmAudioUrl && (
                            <audio
                              key={bgmAudioUrl}
                              src={bgmAudioUrl}
                              controls
                              className="w-full"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => bgmFileRef.current?.click()}
                              className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              {bgmFile ? bgmFile.name : "选择音频文件"}
                            </button>
                            {bgmFile && (
                              <button
                                type="button"
                                onClick={() => onSetBgmFile(null)}
                                className="text-xs text-red-500"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <input
                            ref={bgmFileRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) =>
                              onSetBgmFile(e.target.files?.[0] ?? null)
                            }
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          音乐音量 {bgmVolume}%
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={bgmVolume}
                          onChange={(e) =>
                            onSetBgmVolume(Number(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onMixAudio}
                    disabled={isMixing}
                    className="w-full py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isMixing
                      ? "混音中…（实时渲染，请耐心等待）"
                      : "生成带音频视频"}
                  </button>

                  {audioError && (
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {audioError}
                    </p>
                  )}

                  {mixedVideoUrl && (
                    <div className="space-y-2">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        ✓ 混音完成
                      </p>
                      <video
                        src={mixedVideoUrl}
                        controls
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-[60vh]"
                      />
                      <a
                        href={mixedVideoUrl}
                        download="video-with-audio.webm"
                        className="inline-flex text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                      >
                        下载带音频视频
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
