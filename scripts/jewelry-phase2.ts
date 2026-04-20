/**
 * Phase 2: JmodelsJewelry-style multi-shot ad — mixed-model production.
 *
 * Strategy: Don't pick one winner. Use 3 different models for what each does
 * best, based on Phase 1 findings.
 *
 *   Shot 1 (5s) — Vidu Q3 Pro       ▶ HERO REVEAL: starburst close-up
 *   Shot 2 (6s) — Seedance 1.5 Pro  ▶ ATMOSPHERE: bokeh + lens flare
 *   Shot 3 (6s) — Kling O3 Std      ▶ DETAIL: clean controlled rotation
 *   Shot 4 (5s) — Vidu Q3 Pro       ▶ FINALE: dramatic light beams + starburst
 *
 * All shots: text2video (no reference image), 9:16 720x1280, no on-screen text.
 *
 * Then:
 *   - ffmpeg concat → 22s vertical video
 *   - Replicate musicgen → cinematic BGM (with ffmpeg fallback)
 *   - ffmpeg mix audio
 *   - Upload to R2: demo/jewelry-ad/phase2/jewelry-jmodels-style-v3.mp4
 *
 * Cost: ~$3.40 video + ~$0.30 music = ~$3.70
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { submitVideoTask, getVideoTask, type VideoTask } from "../lib/wavespeed";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDU_KEY = process.env.VIDU_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
if (!VIDU_KEY) {
  console.error("ERROR: VIDU_API_KEY is not set");
  process.exit(1);
}
if (!process.env.WAVESPEED_API_KEY) {
  console.error("ERROR: WAVESPEED_API_KEY is not set");
  process.exit(1);
}
if (!REPLICATE_KEY) {
  console.warn("WARN: REPLICATE_API_KEY not set — will use ffmpeg sine pad as BGM fallback");
}

const VIDU_BASE = "https://api.vidu.com/ent/v2";

// ─── 4-shot storyboard with distinct prompts per visual purpose ────────────

type Shot = {
  name: string;
  duration: number;
  provider: "vidu" | "wavespeed";
  model: string; // model id (or viduq3-pro for Vidu)
  prompt: string;
};

const HERO_REVEAL_PROMPT =
  "Cinematic hero reveal close-up macro shot of a luxurious emerald cushion-cut " +
  "diamond halo ring on platinum band. Single dramatic key light from above-left. " +
  "Deep black reflective acrylic surface beneath. Extreme shallow depth of field, " +
  "100mm macro lens at f/1.2. Sharp focus on the central emerald gem. Each " +
  "surrounding diamond facet emits intense rainbow starburst spikes — brilliant " +
  "4-point and 6-point star highlights radiating outward. Slow pull-back camera " +
  "movement revealing the entire ring. Pure black background. ARRI Alexa LF " +
  "cinematic, ProRes 4444, 8K, hyper-cinematic luxury jewelry brand commercial.";

const ATMOSPHERE_PROMPT =
  "Atmospheric dreamy wide shot of a luxurious emerald cushion-cut diamond halo " +
  "ring on platinum band, sitting on a deep black reflective acrylic surface. " +
  "EXTREME shallow depth of field f/1.2, 100mm macro lens. Soft creamy background " +
  "bokeh with floating circular light particles drifting upward through the air. " +
  "Diagonal anamorphic lens flare streaks across the upper left of the frame. " +
  "Subtle slow camera drift from right to left. Pure black moody background with " +
  "deep shadows. Cinematic ProRes 4444 grade, ARRI Alexa LF, photorealistic, " +
  "hyper-detailed metalwork, luxury high-jewelry brand commercial.";

const DETAIL_ROTATION_PROMPT =
  "Studio jewelry photography of a luxurious emerald cushion-cut diamond halo " +
  "ring on platinum band, slowly rotating with controlled deliberate motion " +
  "showing every angle of the band, halo prongs, and metalwork detail. The ring " +
  "sits on a clean black reflective acrylic surface with a perfect mirror " +
  "reflection beneath. Single soft key light from above creating clean " +
  "highlights. Sharp focus throughout with subtle background blur. Pure black " +
  "background. Hyper-detailed metalwork visible. Slow controlled 90-degree " +
  "rotation. ARRI Alexa, 8K commercial product photography, photorealistic.";

const FINALE_PROMPT =
  "Dramatic finale shot of a luxurious emerald cushion-cut diamond halo ring on " +
  "platinum band. Volumetric light beams stream diagonally across the frame from " +
  "the upper left, illuminating the ring like a spotlight. Each diamond facet " +
  "explodes with intense rainbow starburst light spikes — brilliant lens flares. " +
  "The ring is perfectly centered, slightly tilted, on a deep black reflective " +
  "surface. Extreme shallow depth of field. Pure black background fading to " +
  "void at the edges. Slow zoom in on the central gem. Hyper-cinematic " +
  "ARRI Alexa LF aesthetic, ProRes 4444, 8K luxury jewelry brand commercial " +
  "finale, dramatic and aspirational.";

const SHOTS: Shot[] = [
  {
    name: "shot-1-hero-reveal",
    duration: 5,
    provider: "vidu",
    model: "viduq3-pro",
    prompt: HERO_REVEAL_PROMPT,
  },
  {
    name: "shot-2-atmosphere",
    duration: 6,
    provider: "wavespeed",
    model: "bytedance/seedance-v1.5-pro/text-to-video",
    prompt: ATMOSPHERE_PROMPT,
  },
  {
    name: "shot-3-detail",
    duration: 6,
    provider: "wavespeed",
    model: "kwaivgi/kling-video-o3-std/text-to-video",
    prompt: DETAIL_ROTATION_PROMPT,
  },
  {
    name: "shot-4-finale",
    duration: 5,
    provider: "vidu",
    model: "viduq3-pro",
    prompt: FINALE_PROMPT,
  },
];

const ASPECT = "9:16";
const TOTAL_DURATION = SHOTS.reduce((s, x) => s + x.duration, 0); // 22s

// ─── Vidu helpers ───────────────────────────────────────────────────────────

async function viduSubmit(prompt: string, duration: number): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/text2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      prompt,
      duration,
      aspect_ratio: ASPECT,
      resolution: "720p",
      style: "general",
      movement_amplitude: "small",
      audio: false,
    }),
  });
  if (!res.ok) throw new Error(`Vidu submit failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

async function viduPoll(taskId: string, label: string): Promise<{ url: string; credits?: number }> {
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
      console.log(`  [${label}] [${elapsed}s] state=${data.state}`);
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

// ─── Wavespeed helper ───────────────────────────────────────────────────────

async function wavespeedRun(label: string, modelId: string, prompt: string, duration: number): Promise<string> {
  const submitted = await submitVideoTask({
    modelId,
    prompt,
    duration,
    aspectRatio: ASPECT,
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

// ─── Replicate musicgen ─────────────────────────────────────────────────────

async function generateBgm(durationSec: number, outPath: string): Promise<boolean> {
  if (!REPLICATE_KEY) return false;

  const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
  const prompt =
    "slow elegant cinematic luxury commercial music, soft delicate piano with " +
    "shimmering glass chimes and gentle bell tones, low cinematic ambient bass " +
    "swell, 80 BPM, emotional and aspirational, modern minimal production, " +
    "high-end jewelry advertisement soundtrack";

  console.log(`  → Replicate musicgen (${durationSec}s)...`);
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "wait=300", // wait up to 5 min synchronously
    },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        prompt,
        duration: durationSec,
        model_version: "stereo-melody-large",
        output_format: "mp3",
        normalization_strategy: "peak",
      },
    }),
  });
  if (!res.ok) {
    console.warn(`  ! musicgen failed (${res.status}): ${await res.text()}`);
    return false;
  }
  const data = (await res.json()) as { output?: string | string[]; status?: string; error?: string };
  if (data.error) {
    console.warn(`  ! musicgen error: ${data.error}`);
    return false;
  }
  const audioUrl = Array.isArray(data.output) ? data.output[0] : data.output;
  if (!audioUrl) {
    console.warn(`  ! musicgen no output (status=${data.status})`);
    return false;
  }
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    console.warn(`  ! musicgen download failed`);
    return false;
  }
  writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
  console.log(`  ✓ musicgen → ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Jewelry Ad Phase 2 — Mixed-Model Production ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-p2-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Submit all 4 shots in parallel
  console.log("→ Step 1: submit 4 shots in parallel");
  const submissions = await Promise.all(
    SHOTS.map(async (shot) => {
      if (shot.provider === "vidu") {
        const taskId = await viduSubmit(shot.prompt, shot.duration);
        console.log(`  ✓ ${shot.name} (Vidu): task_id=${taskId}`);
        return { shot, taskId, type: "vidu" as const };
      } else {
        // Wavespeed: submit returns task with poll URL
        const submitted = await submitVideoTask({
          modelId: shot.model,
          prompt: shot.prompt,
          duration: shot.duration,
          aspectRatio: ASPECT,
        });
        const pollUrl = submitted.urls?.get || submitted.id;
        console.log(`  ✓ ${shot.name} (Wavespeed ${shot.model}): ${pollUrl}`);
        return { shot, pollUrl, type: "wavespeed" as const };
      }
    }),
  );

  // 2. Poll all in parallel
  console.log("\n→ Step 2: poll all 4 tasks in parallel");
  const downloaded = await Promise.all(
    submissions.map(async (sub) => {
      let videoUrl: string;
      let credits: number | undefined;
      if (sub.type === "vidu") {
        const r = await viduPoll(sub.taskId, sub.shot.name);
        videoUrl = r.url;
        credits = r.credits;
      } else {
        // Re-poll wavespeed with the existing pollUrl
        const startedAt = Date.now();
        let lastStatus = "";
        while (Date.now() - startedAt < 15 * 60 * 1000) {
          await new Promise((r) => setTimeout(r, 5000));
          let polled: VideoTask;
          try {
            polled = await getVideoTask(sub.pollUrl);
          } catch (e) {
            console.log(`  [${sub.shot.name}] poll error: ${e instanceof Error ? e.message : e}`);
            continue;
          }
          if (polled.status !== lastStatus) {
            const elapsed = Math.round((Date.now() - startedAt) / 1000);
            console.log(`  [${sub.shot.name}] [${elapsed}s] status=${polled.status}`);
            lastStatus = polled.status;
          }
          if (polled.status === "completed" && polled.outputs?.[0]) {
            videoUrl = polled.outputs[0];
            break;
          }
          if (polled.status === "failed") {
            throw new Error(`${sub.shot.name} failed: ${polled.error || "unknown"}`);
          }
        }
        if (!videoUrl!) throw new Error(`${sub.shot.name} timed out`);
      }
      return { shot: sub.shot, videoUrl, credits };
    }),
  );

  // 3. Download each shot + upload to R2 + save local for ffmpeg
  console.log("\n→ Step 3: download + save shots");
  const localPaths: string[] = [];
  let totalCredits = 0;
  for (const d of downloaded) {
    if (d.credits) totalCredits += d.credits;
    console.log(`  → ${d.shot.name}${d.credits ? ` (${d.credits} credits)` : ""}`);
    const dlRes = await fetch(d.videoUrl);
    if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    const localPath = join(tmp, `${d.shot.name}.mp4`);
    writeFileSync(localPath, buf);
    localPaths.push(localPath);
    const uploaded = await put(`demo/jewelry-ad/phase2/${d.shot.name}.mp4`, buf, {
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    console.log(`    ✓ R2: ${uploaded.url} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  // 4. Concat all 4 with re-encode (mixed format/codec from 3 providers)
  // Force consistent 720x1280 with scale+pad to handle any aspect mismatches.
  console.log("\n→ Step 4: ffmpeg concat 4 shots → 22s vertical");
  const concatLocal = join(tmp, "concat.mp4");
  // Use filter_complex concat with normalization
  const inputArgs: string[] = [];
  for (const p of localPaths) inputArgs.push("-i", p);
  // Build the concat filter: scale each to 720x1280, pad if needed, then concat
  const segments = localPaths
    .map(
      (_, i) =>
        `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30[v${i}]`,
    )
    .join(";");
  const concatChain = `${segments};` +
    localPaths.map((_, i) => `[v${i}]`).join("") +
    `concat=n=${localPaths.length}:v=1:a=0[outv]`;
  execFileSync(
    ffmpeg,
    [
      ...inputArgs,
      "-filter_complex", concatChain,
      "-map", "[outv]",
      "-c:v", "libx264", "-preset", "fast", "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-y", concatLocal,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ Concat: ${(readFileSync(concatLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 5. Generate BGM (Replicate musicgen, fallback to ffmpeg sine pad)
  console.log("\n→ Step 5: generate BGM");
  const bgmPath = join(tmp, "bgm.mp3");
  const bgmGenerated = await generateBgm(TOTAL_DURATION, bgmPath);
  let bgmInputArgs: string[];
  let bgmAudioFilter: string;
  if (bgmGenerated) {
    console.log("  ✓ Using Replicate musicgen output");
    bgmInputArgs = ["-i", bgmPath];
    // Single audio input — apply fade and normalize
    bgmAudioFilter = `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=${TOTAL_DURATION - 1.5}:d=1.5,alimiter=limit=0.95[aout]`;
  } else {
    console.log("  ! Falling back to ffmpeg sine pad");
    // Sine pad fallback: C-major triad
    bgmInputArgs = [
      "-f", "lavfi", "-t", String(TOTAL_DURATION), "-i", "sine=frequency=261.63",
      "-f", "lavfi", "-t", String(TOTAL_DURATION), "-i", "sine=frequency=329.63",
      "-f", "lavfi", "-t", String(TOTAL_DURATION), "-i", "sine=frequency=392.00",
    ];
    bgmAudioFilter = `[1:a][2:a][3:a]amix=inputs=3:duration=first,volume=0.30,lowpass=f=900,afade=t=in:d=1.5,afade=t=out:st=${TOTAL_DURATION - 1.5}:d=1.5,alimiter=limit=0.95[aout]`;
  }

  // 6. Final compose: concat video + BGM
  console.log("\n→ Step 6: final compose video + BGM");
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-jmodels-style-v3.mp4";
  execFileSync(
    ffmpeg,
    [
      "-i", concatLocal,
      ...bgmInputArgs,
      "-filter_complex", bgmAudioFilter,
      "-map", "0:v",
      "-map", "[aout]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", finalLocal,
    ],
    { stdio: "pipe" },
  );
  const finalBuf = readFileSync(finalLocal);
  console.log(`  ✓ Final: ${(finalBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // 7. Upload final to R2
  console.log("\n→ Step 7: upload final to R2");
  const finalUploaded = await put(
    "demo/jewelry-ad/phase2/jewelry-jmodels-style-v3.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  // Summary
  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log("✓ Phase 2 complete");
  console.log("========================================");
  console.log(`Total wall time: ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log(`Vidu credits:    ${totalCredits} (${(totalCredits / 100).toFixed(2)} USD)`);
  console.log("\nIndividual shots:");
  for (const d of downloaded) {
    console.log(`  ${d.shot.name} (${d.shot.provider} ${d.shot.model})`);
  }
  console.log(`\n📁 Local: ${finalLocal}`);
  console.log(`🎬 R2:    ${finalUploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2000 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2000));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
