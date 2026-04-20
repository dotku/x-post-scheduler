/**
 * Jewelry ad — 4-way provider comparison.
 *
 * Submits the same emerald-ring reference image to 4 different video models
 * in parallel and uploads each result to R2 for side-by-side review:
 *
 *   B. Vidu Q3 Pro img2video    (Vidu's best img2video model)
 *   C. BytePluses Seedance 1.5  (ByteDance enterprise route to Seedance)
 *   D. Wavespeed Seedance 1.5   (same model as C, via Wavespeed gateway)
 *   E. Wavespeed Wan 2.2 i2v    (different model — Alibaba)
 *
 * Reference image: public R2 URL of the polished first frame from path A.
 * Output: R2 demo/jewelry-ad/comparison/{provider}.mp4
 *
 * Total estimated cost: ~$1.70.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import {
  submitVideoTask,
  getVideoTask,
  type VideoTask,
} from "../lib/wavespeed";
import {
  submitBytePlusVideoTask,
  getBytePlusVideoTask,
} from "../lib/bytepluses";

const VIDU_KEY = process.env.VIDU_API_KEY;
if (!VIDU_KEY) {
  console.error("ERROR: VIDU_API_KEY is not set");
  process.exit(1);
}
if (!process.env.WAVESPEED_API_KEY) {
  console.error("ERROR: WAVESPEED_API_KEY is not set");
  process.exit(1);
}
if (!process.env.BYTEPLUSES_API_KEY) {
  console.error("ERROR: BYTEPLUSES_API_KEY is not set");
  process.exit(1);
}

const REFERENCE_IMAGE_URL =
  "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/polished/jewelry-reference-frame.jpg";

const SHARED_PROMPT =
  "An elegant emerald cushion-cut diamond halo ring rotates slowly, " +
  "shimmering green silk and metallic waves flow gently in the background, " +
  "sparkles and light rays drift across the scene, " +
  "cinematic 3D jewelry visualization, brilliant reflections, slow motion, 4K";

const SHARED_DURATION = 5; // 5s — Vidu Q2/Q3 default sweet spot, also Seedance compatible
const SHARED_ASPECT = "1:1"; // square — matches the source 720x720

// ─── Vidu helpers (img2video) ───────────────────────────────────────────────

const VIDU_BASE = "https://api.vidu.com/ent/v2";

async function viduSubmit(): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/img2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      images: [REFERENCE_IMAGE_URL],
      prompt: SHARED_PROMPT,
      duration: SHARED_DURATION,
      aspect_ratio: "16:9", // viduq3 doesn't accept 1:1 cleanly; we'll crop later
      resolution: "720p",
      movement_amplitude: "auto",
      audio: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Vidu submit failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

type ViduPoll = {
  state: string;
  err_code?: string;
  credits?: number;
  creations?: { id: string; url: string; cover_url?: string }[];
};

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
    const data = (await res.json()) as ViduPoll;
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

// ─── Wavespeed helpers (Seedance + Wan 2.2) ─────────────────────────────────

async function wavespeedRun(label: string, modelId: string): Promise<string> {
  const submitted = await submitVideoTask({
    modelId,
    prompt: SHARED_PROMPT,
    duration: SHARED_DURATION,
    aspectRatio: SHARED_ASPECT,
    imageUrl: REFERENCE_IMAGE_URL,
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

// ─── BytePluses helper ──────────────────────────────────────────────────────

async function bytePlusRun(): Promise<string> {
  const submitted = await submitBytePlusVideoTask({
    modelId: "bytedance/seedance-v1.5-pro/image-to-video",
    prompt: SHARED_PROMPT,
    duration: SHARED_DURATION,
    aspectRatio: SHARED_ASPECT,
    imageUrl: REFERENCE_IMAGE_URL,
  });
  console.log(`  [BytePluses] submitted: ${submitted.id}`);

  const startedAt = Date.now();
  const TIMEOUT = 15 * 60 * 1000;
  let lastStatus = "";
  while (Date.now() - startedAt < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 5000));
    let polled: VideoTask;
    try {
      polled = await getBytePlusVideoTask(submitted.id);
    } catch (e) {
      console.log(`  [BytePluses] poll error: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (polled.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [BytePluses] [${elapsed}s] status=${polled.status}`);
      lastStatus = polled.status;
    }
    if (polled.status === "completed" && polled.outputs?.[0]) {
      return polled.outputs[0];
    }
    if (polled.status === "failed") {
      throw new Error(`BytePluses failed: ${polled.error || "unknown"}`);
    }
  }
  throw new Error("BytePluses timed out");
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

    // Download + upload to R2
    const dlRes = await fetch(videoUrl);
    if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const r2Path = `demo/jewelry-ad/comparison/${slug}.mp4`;
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
  console.log("=== Jewelry Ad — 4-way Provider Comparison ===");
  console.log(`Reference: ${REFERENCE_IMAGE_URL}`);
  console.log(`Prompt: ${SHARED_PROMPT}\n`);
  const overallStart = Date.now();

  // Run all 4 in parallel
  const results = await Promise.all([
    runProvider("vidu-q3-pro", "Vidu", "viduq3-pro img2video", async () => {
      const taskId = await viduSubmit();
      console.log(`  [vidu-q3-pro] task_id=${taskId}`);
      const r = await viduPoll(taskId);
      console.log(`  [vidu-q3-pro] credits=${r.credits ?? "?"}`);
      return r.url;
    }),
    runProvider("bytepluses-seedance", "BytePluses", "Seedance 1.5 Pro i2v", bytePlusRun),
    runProvider("wavespeed-seedance", "Wavespeed", "Seedance 1.5 Pro i2v", () =>
      wavespeedRun("wavespeed-seedance", "bytedance/seedance-v1.5-pro/image-to-video"),
    ),
    runProvider("wavespeed-wan22", "Wavespeed", "Wan 2.2 i2v 720p", () =>
      wavespeedRun("wavespeed-wan22", "wavespeed-ai/wan-2.2/i2v-720p"),
    ),
  ]);

  const totalSec = Math.round((Date.now() - overallStart) / 1000);

  console.log("\n========================================");
  console.log("✓ Comparison complete");
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
