import Link from "next/link";
import type { StudioModel, Tab } from "./constants";
import {
  ASPECT_RATIOS,
  IMAGE_MODELS_T2I,
  IMAGE_MODELS_I2I,
  TIER_COLORS,
} from "./constants";
import {
  inferMediaTypeFromModelId,
  getEstimatedBaseCostCents,
  getEstimatedChargeCents,
  formatUsdFromCents,
  getImageModePath,
} from "./utils";

interface ConfigCardProps {
  tab: Tab;
  videoMode: "t2v" | "i2v";
  imageMode: "t2i" | "i2i" | "i2i_text";
  currentModels: StudioModel[];
  currentModelId: string;
  selectedModel: StudioModel;
  prompt: string;
  aspectIdx: number;
  duration: number;
  generateAudio: boolean;
  lockCamera: boolean;
  saveAsPublic: boolean;
  enableLongVideo: boolean;
  longVideoSegmentsCount: number;
  subscriptionTier: string | null;
  i2vImageUrl: string | null;
  imageInputUrl: string | null;
  imageInputUrls: string[];
  imageUploadLoading: boolean;
  imageUploadError: string;
  imageModelId: string;
  isRunning: boolean;
  isZh: boolean;
  locale: string;
  prefix: string;
  estimatedPromptTokens: number;
  estimatedSingleChargeCents: number;
  estimatedSingleBaseCostCents: number;
  estimatedTotalChargeCents: number;
  estimatedTotalBaseCostCents: number;
  runCount: number;
  durationFactor: number;
  uiText: Record<string, string>;
  onSetVideoMode: (mode: "t2v" | "i2v") => void;
  onSetImageMode: (mode: "t2i" | "i2i" | "i2i_text") => void;
  onSetPrompt: (value: string) => void;
  onSetAspectIdx: (idx: number) => void;
  onSetDuration: (d: number) => void;
  onSetGenerateAudio: (v: boolean) => void;
  onSetLockCamera: (v: boolean) => void;
  onSetSaveAsPublic: (v: boolean) => void;
  onSetEnableLongVideo: (v: boolean) => void;
  onSetLongVideoSegmentsCount: (count: number) => void;
  onSelectModel: (modelId: string, model: StudioModel) => void;
  onSetI2vImageUrl: (url: string | null) => void;
  onSetImageInputUrl: (url: string | null) => void;
  onSetImageInputUrls: React.Dispatch<React.SetStateAction<string[]>>;
  onPasteImage: (
    e: React.ClipboardEvent<HTMLDivElement>,
    target: "i2v" | "i2i",
  ) => void;
  onFilePicked: (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "i2v" | "i2i",
  ) => void;
  onMultiFilePicked: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
}

export default function ConfigCard({
  tab,
  videoMode,
  imageMode,
  currentModels,
  currentModelId,
  selectedModel,
  prompt,
  aspectIdx,
  duration,
  generateAudio,
  lockCamera,
  saveAsPublic,
  enableLongVideo,
  longVideoSegmentsCount,
  subscriptionTier,
  i2vImageUrl,
  imageInputUrl,
  imageInputUrls,
  imageUploadLoading,
  imageUploadError,
  imageModelId,
  isRunning,
  isZh,
  locale,
  prefix,
  estimatedPromptTokens,
  estimatedSingleChargeCents,
  estimatedSingleBaseCostCents,
  estimatedTotalChargeCents,
  estimatedTotalBaseCostCents,
  runCount,
  durationFactor,
  uiText,
  onSetVideoMode,
  onSetImageMode,
  onSetPrompt,
  onSetAspectIdx,
  onSetDuration,
  onSetGenerateAudio,
  onSetLockCamera,
  onSetSaveAsPublic,
  onSetEnableLongVideo,
  onSetLongVideoSegmentsCount,
  onSelectModel,
  onSetI2vImageUrl,
  onSetImageInputUrl,
  onSetImageInputUrls,
  onPasteImage,
  onFilePicked,
  onMultiFilePicked,
  onGenerate,
}: ConfigCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {tab === "image" ? uiText.imageGeneration : uiText.videoGeneration}
        </h2>
      </div>
      <div className="p-6 space-y-5">
        {/* Video mode toggle (t2v / i2v) */}
        {tab === "video" && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSetVideoMode("t2v");
                onSetI2vImageUrl(null);
              }}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                videoMode === "t2v"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {uiText.textToVideo}
            </button>
            <button
              onClick={() => onSetVideoMode("i2v")}
              disabled={isRunning}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                videoMode === "i2v"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {uiText.imageToVideo}
            </button>
          </div>
        )}

        {/* i2v image input */}
        {tab === "video" && videoMode === "i2v" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Input Image
            </label>
            <div
              onPaste={(e) => onPasteImage(e, "i2v")}
              className="mb-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400"
            >
              Paste image here (Ctrl/Cmd+V), or upload from file.
              <div className="mt-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFilePicked(e, "i2v")}
                  disabled={isRunning || imageUploadLoading}
                  className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                />
              </div>
            </div>
            {i2vImageUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={i2vImageUrl}
                  alt="i2v input"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 object-contain"
                />
                <button
                  onClick={() => onSetI2vImageUrl(null)}
                  disabled={isRunning}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <input
                type="url"
                placeholder="Paste image URL..."
                disabled={isRunning}
                onChange={(e) => onSetI2vImageUrl(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              />
            )}
          </div>
        )}

        {/* Image mode selector */}
        {tab === "image" && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                {
                  key: "t2i",
                  label: "Text to Image",
                  path: "/toolbox?tab=image&mode=t2i",
                },
                {
                  key: "i2i",
                  label: "Image to Image",
                  path: "/toolbox?tab=image&mode=i2i",
                },
                {
                  key: "i2i_text",
                  label: "Image + Text to Image",
                  path: "/toolbox?tab=image&mode=i2i_text",
                },
              ] as const
            ).map((modeOption) => (
              <button
                key={modeOption.key}
                onClick={() => {
                  const nextMode = modeOption.key;
                  onSetImageMode(nextMode);
                  const modelList =
                    nextMode === "t2i" ? IMAGE_MODELS_T2I : IMAGE_MODELS_I2I;
                  onSelectModel(modelList[0].id, modelList[0]);
                }}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  imageMode === modeOption.key
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <span className="block">{modeOption.label}</span>
                <span className="block text-[11px] mt-0.5 opacity-80">
                  {modeOption.path}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* i2i / i2i_text image input */}
        {tab === "image" &&
          (imageMode === "i2i" || imageMode === "i2i_text") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {imageModelId === "wavespeed-ai/flux-kontext-pro/multi"
                  ? "参考图片（可多张）"
                  : "Input Image URL"}
              </label>

              {imageModelId === "wavespeed-ai/flux-kontext-pro/multi" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400">
                    选择多张参考图片（最多 4 张）
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => onMultiFilePicked(e)}
                        disabled={
                          isRunning ||
                          imageUploadLoading ||
                          imageInputUrls.length >= 4
                        }
                        className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                      />
                    </div>
                  </div>
                  {imageInputUrls.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {imageInputUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`ref ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                          <button
                            onClick={() =>
                              onSetImageInputUrls((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            disabled={isRunning}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div
                    onPaste={(e) => onPasteImage(e, "i2i")}
                    className="mb-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 text-xs text-gray-500 dark:text-gray-400"
                  >
                    Paste image here (Ctrl/Cmd+V), or upload from file.
                    <div className="mt-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onFilePicked(e, "i2i")}
                        disabled={isRunning || imageUploadLoading}
                        className="block w-full text-xs text-gray-500 dark:text-gray-300 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white"
                      />
                    </div>
                  </div>
                  {imageInputUrl ? (
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageInputUrl}
                        alt="i2i input"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 object-contain"
                      />
                      <button
                        onClick={() => onSetImageInputUrl(null)}
                        disabled={isRunning}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <input
                      type="url"
                      placeholder="Paste image URL..."
                      value={imageInputUrl ?? ""}
                      onChange={(e) =>
                        onSetImageInputUrl(e.target.value || null)
                      }
                      disabled={isRunning}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                    />
                  )}
                </>
              )}
            </div>
          )}

        {imageUploadLoading && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uploading image...
          </p>
        )}
        {imageUploadError && (
          <p className="text-xs text-red-500">{imageUploadError}</p>
        )}

        {/* Model selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Model
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentModels.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelectModel(m.id, m)}
                disabled={isRunning}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                  currentModelId === m.id
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                {(() => {
                  const mediaType: "image" | "video" =
                    tab === "video"
                      ? "video"
                      : inferMediaTypeFromModelId(m.id);
                  const singleBaseCostCents = Math.round(
                    getEstimatedBaseCostCents(m.id, mediaType) *
                      (tab === "video" ? Math.max(1, duration / 5) : 1),
                  );
                  const singleChargeCents = Math.round(
                    getEstimatedChargeCents(m.id, mediaType) *
                      (tab === "video" ? Math.max(1, duration / 5) : 1),
                  );
                  return (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {m.label}
                        {tab === "video" && m.supportsAudio && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                            {isZh ? "支持音频" : "Audio"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.description}
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        Cost est: {formatUsdFromCents(singleChargeCents)}{" "}
                        charged · {formatUsdFromCents(singleBaseCostCents)}{" "}
                        model cost · token est ~
                        {Math.max(
                          0,
                          Math.ceil((prompt.trim().length || 0) / 4),
                        ).toLocaleString()}
                      </p>
                    </div>
                  );
                })()}
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[m.tier]}`}
                >
                  {m.tier}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Path info */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-1">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Path Info
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
            Visiting Path:{" "}
            <code className="text-gray-800 dark:text-gray-200">
              {tab === "video"
                ? `/toolbox?tab=video&mode=${videoMode}`
                : getImageModePath(imageMode)}
            </code>
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 break-all">
            Model Path:{" "}
            <code className="text-gray-800 dark:text-gray-200">
              {selectedModel?.id ?? currentModelId}
            </code>
          </p>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Prompt{" "}
            {tab === "image" && (
              <span className="text-gray-400 font-normal">（支持中文）</span>
            )}
          </label>
          <textarea
            value={prompt}
            onChange={(e) => onSetPrompt(e.target.value)}
            rows={3}
            placeholder={
              tab === "image"
                ? imageMode === "i2i"
                  ? "可选：描述希望优化方向（不填也可以）"
                  : imageMode === "i2i_text"
                    ? "描述修改内容，例如：修复图中的中文文字乱码，正确文字应为「…」，保持版式不变"
                    : "描述你想要的图片，支持中英文..."
                : "Describe the video you want to generate..."
            }
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
            disabled={isRunning}
          />
          {tab === "image" &&
            imageMode === "i2i_text" &&
            (imageModelId === "wavespeed-ai/flux-kontext-pro" ||
              imageModelId === "wavespeed-ai/flux-kontext-pro/multi") &&
            !prompt && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">修复中文文字提示模板：</span>{" "}
                <button
                  type="button"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
                  onClick={() =>
                    onSetPrompt(
                      "请修复图片中所有乱码的中文文字，保持原有版式、字体颜色、字号和位置完全不变，只将乱码替换为正确的中文内容。正确的文字应该是：「在此填写正确文字」",
                    )
                  }
                >
                  点击填入模板
                </button>
              </div>
            )}
        </div>

        {/* Aspect ratio + Duration */}
        <div
          className={`grid gap-4 ${tab === "video" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Aspect Ratio
            </label>
            <select
              value={aspectIdx}
              onChange={(e) => onSetAspectIdx(Number(e.target.value))}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
            >
              {ASPECT_RATIOS.map((r, i) => (
                <option key={i} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {tab === "video" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration
              </label>
              <div className="flex gap-2">
                {(selectedModel?.durations ?? [5, 8]).map((d) => (
                  <button
                    key={d}
                    onClick={() => onSetDuration(d)}
                    disabled={isRunning}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      duration === d
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Audio toggle */}
        {tab === "video" && selectedModel?.supportsAudio && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={generateAudio}
              onChange={(e) => onSetGenerateAudio(e.target.checked)}
              disabled={isRunning}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            {isZh ? "生成有声视频" : "Generate audio"}
          </label>
        )}

        {/* Lock camera toggle — Seedance 2.0 only */}
        {tab === "video" && currentModelId.startsWith("seedance-2.0/") && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={lockCamera}
              onChange={(e) => onSetLockCamera(e.target.checked)}
              disabled={isRunning}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            {isZh
              ? "锁定镜头（减少运镜晃动）"
              : "Lock camera (reduce motion blur)"}
          </label>
        )}

        {/* Long video generation — members only */}
        {tab === "video" && (
          <div className="space-y-2">
            {subscriptionTier ? (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={enableLongVideo}
                    onChange={(e) => onSetEnableLongVideo(e.target.checked)}
                    disabled={isRunning}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  {locale === "zh"
                    ? "生成长视频（多段拼接）"
                    : "Generate long video (multi-segment)"}
                </label>
                {enableLongVideo && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">
                      {locale === "zh" ? "段数:" : "Segments:"}
                    </span>
                    <select
                      value={longVideoSegmentsCount}
                      onChange={(e) =>
                        onSetLongVideoSegmentsCount(Number(e.target.value))
                      }
                      disabled={isRunning}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      ))}
                    </select>
                    <span className="text-gray-400">
                      ({duration}s {locale === "zh" ? "每段" : "each"})
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
                <span>🔒</span>
                <span>
                  {locale === "zh"
                    ? "长视频生成为会员专属功能"
                    : "Long video generation is a members-only feature"}
                </span>
                <Link
                  href={`/${locale}/settings`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {locale === "zh" ? "升级会员 →" : "Subscribe →"}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Estimated usage & cost */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3 space-y-1.5">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            Estimated Usage & Cost
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Model-side prompt tokens (est.): ~
            {estimatedPromptTokens.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            User charge (single run):{" "}
            {formatUsdFromCents(estimatedSingleChargeCents)}
            {tab === "video"
              ? ` · duration factor x${durationFactor.toFixed(1)}`
              : ""}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Model provider cost (single run):{" "}
            {formatUsdFromCents(estimatedSingleBaseCostCents)}
          </p>
          {runCount > 1 && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Total for {runCount} runs:{" "}
              {formatUsdFromCents(estimatedTotalChargeCents)} charged ·{" "}
              {formatUsdFromCents(estimatedTotalBaseCostCents)} provider cost
            </p>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-500">
            Note: The image/video service is task-priced. Token estimate is
            prompt-length based and for reference only.
          </p>
        </div>

        {/* Save as public checkbox */}
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={saveAsPublic}
            onChange={(e) => onSetSaveAsPublic(e.target.checked)}
            disabled={isRunning}
            className="h-4 w-4 text-purple-600 border-gray-300 rounded"
          />
          Save to Gallery as public
        </label>

        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={
            isRunning ||
            (tab === "video" &&
              (!prompt.trim() || (videoMode === "i2v" && !i2vImageUrl))) ||
            (tab === "image" &&
              (imageMode === "t2i" || imageMode === "i2i_text") &&
              !prompt.trim()) ||
            (tab === "image" &&
              (imageMode === "i2i" || imageMode === "i2i_text") &&
              !imageInputUrl &&
              !(
                imageModelId === "wavespeed-ai/flux-kontext-pro/multi" &&
                imageInputUrls.length > 0
              ))
          }
          className="w-full py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning
            ? tab === "image"
              ? "生成中..."
              : "generating" === "generating"
                ? "Submitting..."
                : "Generating..."
            : tab === "image"
              ? "生成图片"
              : "Generate Video"}
        </button>
      </div>
    </div>
  );
}
