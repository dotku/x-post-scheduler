/**
 * Phase 1: Prompt validation experiment.
 *
 * Hypothesis: With a JmodelsJewelry-level prompt (extreme detail about
 * lighting, lens, depth-of-field, surface, camera motion), one of these
 * models can produce a single shot that matches their actual TikTok output.
 *
 * Tests (all text2video, no reference image — let each model freely compose
 * black-background studio jewelry photography):
 *
 *   1. Wavespeed Kling O3 Std    (untested, "best motion quality" per Wavespeed)
 *   2. Wavespeed Seedance 1.5 Pro (winner of previous comparison)
 *   3. Vidu Q3 Pro                (premium baseline, expensive)
 *
 * Format: 9:16 vertical (TikTok native, matching JmodelsJewelry's actual format)
 *
 * Total cost: ~$2.15
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { submitVideoTask, getVideoTask, type VideoTask } from "../lib/wavespeed";

const VIDU_KEY = process.env.VIDU_API_KEY;
if (!VIDU_KEY) {
  console.error("ERROR: VIDU_API_KEY is not set");
  process.exit(1);
}
if (!process.env.WAVESPEED_API_KEY) {
  console.error("ERROR: WAVESPEED_API_KEY is not set");
  process.exit(1);
}

// ─── The prompt that should unlock JmodelsJewelry-level output ──────────────

const ARRI_PROMPT =
  "Studio jewelry photography commercial of a luxurious emerald cushion-cut " +
  "diamond halo ring on platinum band. Single dramatic key light from above " +
  "left at 45 degrees creates deep chiaroscuro. The ring sits on a deep black " +
  "reflective acrylic surface with a perfect mirror reflection beneath it. " +
  "Extreme shallow depth of field at f/1.4 with a 100mm macro lens — sharp " +
  "focus on the central emerald gem, surrounding diamond halo refracting " +
  "intense light into rainbow spectrum highlights, all background dissolving " +
  "into creamy bokeh. The ring rotates very slowly with controlled deliberate " +
  "motion, only 15 degrees over the entire duration. Pure black background " +
  "with subtle deep shadows. Hyper-cinematic luxury high-jewelry brand " +
  "commercial, ARRI Alexa LF aesthetic, ProRes 4444 grade, 8K resolution, " +
  "deep blacks, brilliant white sparkles, photorealistic, hyper-detailed " +
  "metalwork, perfect product photography, slow motion 30fps";

const SHARED_DURATION = 5;
const SHARED_ASPECT = "9:16"; // TikTok native, matching JmodelsJewelry

// ─── Vidu helpers ───────────────────────────────────────────────────────────

const VIDU_BASE = "https://api.vidu.com/ent/v2";

async function viduSubmit(): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/text2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      prompt: ARRI_PROMPT,
      duration: SHARED_DURATION,
      aspect_ratio: SHARED_ASPECT,
      resolution: "720p",
      style: "general",
      movement_amplitude: "small", // Match the "controlled deliberate motion"
      audio: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Vidu submit failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

async function viduPoll(
  taskId: string,
): Promise<{ url: string; credits?: number }> {
  const startedAt = Date.now();
  const TIMEOUT = 15 * 60 * 1000;
  let lastState = "";
  while (Date.now() - startedAt < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${VIDU_BASE}/tasks/${taskId}/creations`, {
      headers: { Authorization: `Token ${VIDU_KEY}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as {
      state: string;
      err_code?: string;
      credits?: number;
      creations?: { id: string; url: string }[];
    };
    if (data.state !== lastState) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [Vidu] [${elapsed}s] state=${data.state}`);
      lastState = data.state;
    }
    if (data.state === "success" && data.creations?.[0]) {
      return { url: data.creations[0].url, credits: data.credits };
    }
    if (data.state === "failed") {
      throw new Error(`Vidu task failed: ${data.err_code || "unknown"}`);
    }
  }
  throw new Error("Vidu task timed out");
}

// ─── Wavespeed helper (used for both Kling and Seedance) ────────────────────

async function wavespeedRun(label: string, modelId: string): Promise<string> {
  const submitted = await submitVideoTask({
    modelId,
    prompt: ARRI_PROMPT,
    duration: SHARED_DURATION,
    aspectRatio: SHARED_ASPECT,
    // No imageUrl — text-to-video, free composition
  });
  const pollUrl = submitted.urls?.get || submitted.id;
  console.log(`  [${label}] submitted: ${pollUrl}`);

  const startedAt = Date.now();
  const TIMEOUT = 15 * 60 * 1000;
  let lastStatus = "";
  while (Date.now() - startedAt < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 5000));
    let polled: VideoTask;
    try {
      polled = await getVideoTask(pollUrl);
    } catch (e) {
      console.log(`  [${label}] poll error: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (polled.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${label}] [${elapsed}s] status=${polled.status}`);
      lastStatus = polled.status;
    }
    if (polled.status === "completed" && polled.outputs?.[0]) {
      return polled.outputs[0];
    }
    if (polled.status === "failed") {
      throw new Error(`${label} failed: ${polled.error || "unknown"}`);
    }
  }
  throw new Error(`${label} timed out`);
}

// ─── Pipeline runner ────────────────────────────────────────────────────────

type Result = {
  label: string;
  provider: string;
  model: string;
  videoUrl: string | null;
  r2Url: string | null;
  durationSec: number;
  error?: string;
};

async function runProvider(
  label: string,
  provider: string,
  model: string,
  fn: () => Promise<string>,
): Promise<Result> {
  const startedAt = Date.now();
  try {
    console.log(`\n→ [${label}] starting ${provider} (${model})...`);
    const videoUrl = await fn();
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    console.log(`  [${label}] ✓ video URL: ${videoUrl}`);

    const dlRes = await fetch(videoUrl);
    if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const r2Path = `demo/jewelry-ad/phase1/${slug}.mp4`;
    const uploaded = await put(r2Path, buf, {
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    console.log(`  [${label}] ✓ R2: ${uploaded.url} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);

    return { label, provider, model, videoUrl, r2Url: uploaded.url, durationSec };
  } catch (e) {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const error = e instanceof Error ? e.message : String(e);
    console.error(`  [${label}] ✗ ${error}`);
    return { label, provider, model, videoUrl: null, r2Url: null, durationSec, error };
  }
}

async function main() {
  console.log("=== Jewelry Ad Phase 1 — ARRI-Level Prompt Test (9:16) ===\n");
  console.log("Prompt:");
  console.log(ARRI_PROMPT);
  console.log();

  const overallStart = Date.now();

  const results = await Promise.all([
    runProvider("kling-o3-std", "Wavespeed", "Kling O3 Std t2v", () =>
      wavespeedRun("kling-o3-std", "kwaivgi/kling-video-o3-std/text-to-video"),
    ),
    runProvider("seedance-15-pro", "Wavespeed", "Seedance 1.5 Pro t2v", () =>
      wavespeedRun("seedance-15-pro", "bytedance/seedance-v1.5-pro/text-to-video"),
    ),
    runProvider("vidu-q3-pro", "Vidu", "viduq3-pro t2v", async () => {
      const taskId = await viduSubmit();
      console.log(`  [vidu-q3-pro] task_id=${taskId}`);
      const r = await viduPoll(taskId);
      console.log(`  [vidu-q3-pro] credits=${r.credits ?? "?"}`);
      return r.url;
    }),
  ]);

  const totalSec = Math.round((Date.now() - overallStart) / 1000);

  console.log("\n========================================");
  console.log("✓ Phase 1 complete");
  console.log("========================================");
  console.log(`Total wall time: ${Math.floor(totalSec / 60)}m ${totalSec % 60}s\n`);

  console.log("| Path | Provider | Model | Time | R2 URL |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    const status = r.r2Url ? r.r2Url : `❌ ${r.error}`;
    console.log(`| ${r.label} | ${r.provider} | ${r.model} | ${r.durationSec}s | ${status} |`);
  }
}

main().catch((e) => {
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
