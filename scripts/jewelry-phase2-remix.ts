/**
 * Phase 2 — REMIX only (no video re-spend).
 *
 * Pulls the 4 already-generated shots from R2, re-runs Replicate musicgen
 * with the correct Prefer header (max 60), waits longer if needed via async
 * polling, then re-mixes the concat with proper BGM.
 *
 * Final result overwrites the same R2 path:
 *   demo/jewelry-ad/phase2/jewelry-jmodels-style-v3.mp4
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
if (!REPLICATE_KEY) {
  console.error("ERROR: REPLICATE_API_KEY is not set");
  process.exit(1);
}

const R2_BASE = "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase2";
const SHOT_NAMES = [
  "shot-1-hero-reveal",
  "shot-2-atmosphere",
  "shot-3-detail",
  "shot-4-finale",
];
const TOTAL_DURATION = 22;

// musicgen via Replicate — async submit + poll until ready (no Prefer:wait,
// since musicgen takes 60-180s and the wait header maxes at 60).
const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MUSICGEN_PROMPT =
  "slow elegant cinematic luxury commercial music, soft delicate piano with " +
  "shimmering glass chimes and gentle bell tones, subtle low cinematic ambient " +
  "bass, 80 BPM, emotional and aspirational, minimal modern production, " +
  "high-end jewelry advertisement soundtrack, no vocals";

async function generateBgmAsync(durationSec: number, outPath: string): Promise<boolean> {
  console.log("→ musicgen submit (async)...");
  const submitRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        prompt: MUSICGEN_PROMPT,
        duration: durationSec,
        model_version: "stereo-melody-large",
        output_format: "mp3",
        normalization_strategy: "peak",
      },
    }),
  });
  if (!submitRes.ok) {
    console.error(`  ! musicgen submit failed (${submitRes.status}): ${await submitRes.text()}`);
    return false;
  }
  const submitData = (await submitRes.json()) as { id: string; urls?: { get: string }; status?: string };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) {
    console.error(`  ! musicgen no poll URL`);
    return false;
  }
  console.log(`  ✓ Submitted: ${submitData.id}`);

  // Poll
  const startedAt = Date.now();
  const TIMEOUT = 10 * 60 * 1000; // 10 min
  let lastStatus = "";
  while (Date.now() - startedAt < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!pollRes.ok) {
      console.warn(`  ! poll http ${pollRes.status}`);
      continue;
    }
    const data = (await pollRes.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };
    if (data.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${elapsed}s] status=${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      if (!audioRes.ok) {
        console.error(`  ! audio download failed`);
        return false;
      }
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ Downloaded ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return true;
    }
    if (data.status === "failed" || data.status === "canceled") {
      console.error(`  ! musicgen ${data.status}: ${data.error || ""}`);
      return false;
    }
  }
  console.error("  ! musicgen timed out");
  return false;
}

async function main() {
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-remix-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  console.log("=== Phase 2 Remix (BGM only, no video re-spend) ===\n");

  // 1. Download 4 shots from R2
  console.log("→ Step 1: download 4 shots from R2");
  const localPaths: string[] = [];
  for (const name of SHOT_NAMES) {
    const url = `${R2_BASE}/${name}.mp4`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const localPath = join(tmp, `${name}.mp4`);
    writeFileSync(localPath, buf);
    localPaths.push(localPath);
    console.log(`  ✓ ${name} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  // 2. Concat with normalization (same as Phase 2)
  console.log("\n→ Step 2: ffmpeg concat 4 shots → 22s");
  const concatLocal = join(tmp, "concat.mp4");
  const inputArgs: string[] = [];
  for (const p of localPaths) inputArgs.push("-i", p);
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
  console.log(`  ✓ ${(readFileSync(concatLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 3. Generate BGM via musicgen
  console.log("\n→ Step 3: generate BGM (Replicate musicgen)");
  const bgmPath = join(tmp, "bgm.mp3");
  const bgmGenerated = await generateBgmAsync(TOTAL_DURATION, bgmPath);

  if (!bgmGenerated) {
    console.error("\nFatal: musicgen failed. The previous Phase 2 run already saved a sine-pad fallback version. Aborting remix.");
    process.exit(1);
  }

  // 4. Mix BGM with concat
  console.log("\n→ Step 4: mix BGM with concat");
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-jmodels-style-v3.mp4";
  execFileSync(
    ffmpeg,
    [
      "-i", concatLocal,
      "-i", bgmPath,
      "-filter_complex",
      `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=${TOTAL_DURATION - 1.5}:d=1.5,alimiter=limit=0.95[aout]`,
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

  // 5. Upload (overwrite same path)
  console.log("\n→ Step 5: upload to R2 (overwrite)");
  const uploaded = await put(
    "demo/jewelry-ad/phase2/jewelry-jmodels-style-v3.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  // Also save a copy of the BGM for archival
  const bgmBuf = readFileSync(bgmPath);
  const bgmUploaded = await put(
    "demo/jewelry-ad/phase2/musicgen-bgm.mp3",
    bgmBuf,
    { contentType: "audio/mpeg", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Remix done in ${totalSec}s`);
  console.log("========================================");
  console.log(`📁 Local: ${finalLocal}`);
  console.log(`🎬 R2:    ${uploaded.url}`);
  console.log(`🎵 BGM:   ${bgmUploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2000 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2000));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
