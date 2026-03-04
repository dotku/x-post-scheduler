import {
  CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS,
  CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER,
  CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER,
  type Tab,
} from "./constants";

export function inferMediaTypeFromModelId(modelId: string): "image" | "video" {
  const id = modelId.toLowerCase();
  if (
    id.includes("video") ||
    id.includes("/t2v") ||
    id.includes("/i2v") ||
    id.includes("seedance")
  ) {
    return "video";
  }
  return "image";
}

export function getEstimatedBaseCostCents(
  modelId: string,
  mediaType: "image" | "video",
) {
  return (
    CLIENT_WAVESPEED_MODEL_BASE_COST_CENTS[modelId] ??
    (mediaType === "video" ? 30 : 5)
  );
}

export function getEstimatedChargeCents(
  modelId: string,
  mediaType: "image" | "video",
) {
  const baseCostCents = getEstimatedBaseCostCents(modelId, mediaType);
  const multiplier =
    mediaType === "video"
      ? CLIENT_WAVESPEED_VIDEO_CHARGE_MULTIPLIER
      : CLIENT_WAVESPEED_IMAGE_CHARGE_MULTIPLIER;
  return Math.max(1, Math.ceil(baseCostCents * multiplier));
}

export function formatUsdFromCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function getImageModePath(mode: "t2i" | "i2i" | "i2i_text") {
  switch (mode) {
    case "t2i":
      return "/toolbox?tab=image&mode=t2i";
    case "i2i":
      return "/toolbox?tab=image&mode=i2i";
    case "i2i_text":
      return "/toolbox?tab=image&mode=i2i_text";
    default:
      return "/toolbox?tab=image";
  }
}

export function getStitchEstimateCents(clipCount: number): number {
  return 10 + 5 * clipCount;
}

export function getToolboxVisitingPath(
  tab: Tab,
  videoMode: "t2v" | "i2v",
  imageMode: "t2i" | "i2i" | "i2i_text",
) {
  if (tab === "video") {
    return `/toolbox?tab=video&mode=${videoMode}`;
  }
  return `/toolbox?tab=image&mode=${imageMode}`;
}
