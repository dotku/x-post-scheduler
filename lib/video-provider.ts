import {
  submitVideoTask as submitWavespeed,
  getVideoTask as getWavespeed,
} from "./wavespeed";
import type { VideoSubmitParams, VideoTask } from "./wavespeed";
import {
  submitSeedanceVideoTask,
  getSeedanceVideoTask,
} from "./seedance";

export type VideoProvider = "wavespeed" | "seedance";

export interface VideoProviderOptions {
  userSeedanceKey?: string;
}

export function detectVideoProvider(modelId: string): VideoProvider {
  if (modelId.startsWith("seedance-2.0/")) return "seedance";
  return "wavespeed";
}

export async function submitVideo(
  params: VideoSubmitParams,
  options?: VideoProviderOptions,
): Promise<VideoTask> {
  const provider = detectVideoProvider(params.modelId);
  if (provider === "seedance") {
    return submitSeedanceVideoTask(params, options?.userSeedanceKey);
  }
  return submitWavespeed(params);
}

export async function pollVideo(
  taskIdOrUrl: string,
  provider: VideoProvider,
  options?: VideoProviderOptions,
): Promise<VideoTask> {
  if (provider === "seedance") {
    return getSeedanceVideoTask(taskIdOrUrl, options?.userSeedanceKey);
  }
  return getWavespeed(taskIdOrUrl);
}
