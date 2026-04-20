/**
 * Animation plan schema — shared between the Director (LLM output) and the
 * Orchestrator (pipeline input). The LLM returns this JSON shape, and the
 * orchestrator consumes it verbatim.
 */

export type VideoProvider = "seedance-2.0" | "vidu-q3-pro";

export type NarrationVoice =
  // Female
  | "af_bella"    // young, soft, romantic
  | "af_nova"     // neutral, crisp
  // Male
  | "am_michael"  // elder, warm
  | "am_onyx";    // deep, narrator

export type AspectRatio = "9:16" | "16:9" | "1:1";

/**
 * Single scene. Both image and motion prompts include the character/style
 * anchors verbatim — the Director is instructed to paraphrase NEVER.
 */
export type AnimationScene = {
  id: string;                 // "01-intro", "02-meeting", ...
  imagePrompt: string;        // keyframe prompt (Wavespeed/BytePlus Seedream)
  motionPrompt: string;       // i2v prompt (Seedance/Vidu)
  duration: 4 | 8;            // seconds (12 supported by Seedance but $$)
  narration?: string;         // optional VO line spoken over this scene
};

/**
 * Complete plan. Everything the orchestrator needs to produce a finished
 * animation short.
 */
export type AnimationPlan = {
  title: string;              // "FIRST LIGHT"
  subtitle?: string;          // "a short anime film"
  aspectRatio: AspectRatio;
  videoModel: VideoProvider;
  narrationVoice: NarrationVoice;

  /** Character anchor — reused verbatim in every scene's prompts. */
  characters: string;

  /** Style anchor — reused verbatim in every scene's prompts. */
  style: string;

  /** BGM description passed to Replicate musicgen. */
  musicPrompt: string;

  /** 2-6 scenes. Each is 4-8 seconds. */
  scenes: AnimationScene[];

  /** Optional 2s opening title card text. */
  openingTitle?: string;

  /** Optional 2s end card text. */
  endCard?: string;
};

/** Rough cost estimate for budgeting / UI display. */
export function estimatePlanCostUsd(plan: AnimationPlan): number {
  const videoPerSec =
    plan.videoModel === "seedance-2.0"
      ? 0.075    // ~$0.60 / 8s
      : 0.25;    // Vidu Q3 Pro ~$2.00 / 8s
  const videoSec = plan.scenes.reduce((s, sc) => s + sc.duration, 0);
  const videoCost = videoSec * videoPerSec;

  const keyframeCost = plan.scenes.length * 0.04;  // Seedream $0.04 ea
  const musicCost = 0.02;
  const narrationCost = 0.005;
  const directorLlmCost = 0.02;

  return videoCost + keyframeCost + musicCost + narrationCost + directorLlmCost;
}

/** Validation — runtime check that LLM output matches schema. */
export function validatePlan(plan: unknown): AnimationPlan {
  if (!plan || typeof plan !== "object") throw new Error("plan must be an object");
  const p = plan as Record<string, unknown>;

  const requiredStrings = ["title", "aspectRatio", "videoModel", "narrationVoice", "characters", "style", "musicPrompt"];
  for (const k of requiredStrings) {
    if (typeof p[k] !== "string" || !p[k]) {
      throw new Error(`plan.${k} must be a non-empty string`);
    }
  }

  if (!Array.isArray(p.scenes)) throw new Error("plan.scenes must be an array");
  if (p.scenes.length < 1 || p.scenes.length > 6) {
    throw new Error(`plan.scenes must have 1-6 items (got ${p.scenes.length})`);
  }

  const validAspect = ["9:16", "16:9", "1:1"];
  if (!validAspect.includes(p.aspectRatio as string)) {
    throw new Error(`plan.aspectRatio must be one of ${validAspect.join(", ")}`);
  }

  const validModels = ["seedance-2.0", "vidu-q3-pro"];
  if (!validModels.includes(p.videoModel as string)) {
    throw new Error(`plan.videoModel must be one of ${validModels.join(", ")}`);
  }

  for (let i = 0; i < p.scenes.length; i++) {
    const s = p.scenes[i] as Record<string, unknown>;
    if (typeof s.id !== "string" || !s.id) throw new Error(`scenes[${i}].id required`);
    if (typeof s.imagePrompt !== "string" || !s.imagePrompt) throw new Error(`scenes[${i}].imagePrompt required`);
    if (typeof s.motionPrompt !== "string" || !s.motionPrompt) throw new Error(`scenes[${i}].motionPrompt required`);
    if (s.duration !== 4 && s.duration !== 8) {
      throw new Error(`scenes[${i}].duration must be 4 or 8`);
    }
    if (s.narration !== undefined && typeof s.narration !== "string") {
      throw new Error(`scenes[${i}].narration must be a string if present`);
    }
  }

  return p as unknown as AnimationPlan;
}
