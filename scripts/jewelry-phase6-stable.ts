/**
 * Phase 6: Stable rebuild — fix the v5 ring-morph and fake-snow problems.
 *
 * Insight: AI video models drift on long takes with subject motion. JModels
 * actual videos use static rings + camera motion. So:
 *
 *   - Vidu generates a SHORT (6s) shot with COMPLETELY STATIC ring,
 *     minimal/zero camera motion. No "rotation", no "orbit".
 *   - ffmpeg adds Ken Burns subtle zoom-in (mathematically perfect motion).
 *   - ffmpeg composites ~25 falling snow particles via drawbox chain
 *     (physics-based linear fall + gentle sin drift).
 *   - ffmpeg loops forward+reverse to extend 6s → 12s.
 *   - Same Phase 5 master reference image (the ring composition was good).
 *   - Same musicgen BGM, same brand title card.
 *
 * Cost: ~$1.55 (6s viduq3-pro is cheaper than 10s).
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

const VIDU_KEY = process.env.VIDU_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
if (!VIDU_KEY || !REPLICATE_KEY) {
  console.error("ERROR: missing VIDU_API_KEY or REPLICATE_API_KEY");
  process.exit(1);
}

const VIDU_BASE = "https://api.vidu.com/ent/v2";

// Re-use Phase 5's master reference (the ring + snow composition was good)
const REFERENCE_URL =
  "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase5/master-reference.png";

// ─── STATIONARY motion prompt — the key fix ────────────────────────────────

const STATIC_PROMPT =
  "This exact emerald diamond ring sits on snow with snowy mountains in the " +
  "background. The ring is COMPLETELY STATIONARY throughout the entire shot — " +
  "the ring does NOT rotate, does NOT move, does NOT change shape, does NOT " +
  "morph. The ring shape, prongs, halo diamond count, band proportions, and " +
  "every facet remain absolutely identical from the first frame to the last " +
  "frame, perfectly stable like a real photograph. The camera holds " +
  "completely still on the ring with only the very subtlest possible " +
  "atmospheric breathing — no panning, no orbit, no rotation, no zoom. " +
  "The only thing that may animate is the diamond facets catching gentle " +
  "white sparkles of light, and the soft snowy mountain background having " +
  "subtle atmospheric haze. Bright high-key daylight, airy ethereal mood, " +
  "Cartier Panthère brand commercial aesthetic. Pure white pinpoint diamond " +
  "sparkles only, no rainbow colors, no chromatic aberration. " +
  "Photorealistic 8K product photography, ARRI Alexa LF aesthetic, " +
  "raytraced lighting, physically based materials, HOLD STEADY shot.";

async function viduSubmit(): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/img2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      images: [REFERENCE_URL],
      prompt: STATIC_PROMPT,
      duration: 6, // shorter = less drift
      aspect_ratio: "9:16",
      resolution: "720p",
      movement_amplitude: "small", // minimum motion
      audio: false,
    }),
  });
  if (!res.ok) throw new Error(`Vidu submit (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

async function viduPoll(taskId: string): Promise<{ url: string; credits?: number }> {
  const startedAt = Date.now();
  let lastState = "";
  while (Date.now() - startedAt < 15 * 60 * 1000) {
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
      throw new Error(`Vidu failed: ${data.err_code || "unknown"}`);
    }
  }
  throw new Error("Vidu timed out");
}

// ─── Replicate musicgen ────────────────────────────────────────────────────

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MUSIC_PROMPT =
  "Ultra-slow cinematic luxury brand commercial soundtrack, 70 BPM, soft " +
  "intimate piano with shimmering crystalline chimes that ring out gently, " +
  "deep velvety cinematic ambient bass swell, sparse delicate bell tones, " +
  "emotional aspirational mood, hyper-minimal modern production, no drums, " +
  "no vocals, designed for a high-end Cartier or Bulgari jewelry commercial";

async function generateBgm(durationSec: number, outPath: string): Promise<void> {
  console.log(`→ musicgen ${durationSec}s`);
  const submitRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        prompt: MUSIC_PROMPT,
        duration: durationSec,
        model_version: "stereo-melody-large",
        output_format: "mp3",
        normalization_strategy: "peak",
      },
    }),
  });
  if (!submitRes.ok) throw new Error(`musicgen submit (${submitRes.status}): ${await submitRes.text()}`);
  const submitData = (await submitRes.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) throw new Error("musicgen no poll URL");
  console.log(`  ✓ submitted: ${submitData.id}`);

  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${elapsed}s] status=${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      if (!audioRes.ok) throw new Error(`Audio download failed`);
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`musicgen ${data.status}: ${data.error || ""}`);
    }
  }
  throw new Error("musicgen timed out");
}

// ─── Snow particle generator ────────────────────────────────────────────────

/**
 * Generate a labeled-chain ffmpeg filter that draws N falling snow particles.
 * Each particle has:
 *   - random start X
 *   - linear fall (y = startY + speed * (t - startTime))
 *   - gentle horizontal sin drift
 *   - random size 3-8 px
 *   - random alpha 0.4-0.85
 *   - some particles "front-fast" (foreground), some "back-slow" (background)
 *
 * Returns { chain: filter graph string, outLabel: label of final video }.
 */
function buildSnowOverlay(count: number, totalDuration: number, inputLabel: string): {
  chain: string;
  outLabel: string;
} {
  // Deterministic seed via simple LCG so re-runs are consistent
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const filters: string[] = [];
  let prev = inputLabel;

  for (let i = 0; i < count; i++) {
    // Front (faster, larger, brighter) or back (slower, smaller, dimmer)
    const isFront = rand() > 0.6;
    const startX = Math.floor(rand() * 720);
    const fallSpeed = isFront ? 130 + rand() * 70 : 50 + rand() * 50;
    // Stagger start times so flakes appear throughout the shot, not all at once
    const startTime = -2 + rand() * (totalDuration + 2); // some already mid-fall at t=0
    const size = isFront ? 5 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 3);
    const alpha = isFront ? 0.65 + rand() * 0.25 : 0.35 + rand() * 0.25;
    const driftAmp = 6 + rand() * 18;
    const driftFreq = 0.4 + rand() * 1.0;

    // x = startX + driftAmp * sin((t-startTime) * driftFreq)
    // y = -20 + (t-startTime) * fallSpeed
    // Use \, to escape commas inside expressions because the filter graph
    // uses , as filter separator at the top level — we'll wrap each drawbox
    // in [prev] → [next] labeled chains and use ; separators.
    const xExpr = `${startX}+${driftAmp.toFixed(1)}*sin((t-(${startTime.toFixed(2)}))*${driftFreq.toFixed(2)})`;
    const yExpr = `-20+(t-(${startTime.toFixed(2)}))*${fallSpeed.toFixed(0)}`;

    const next = `s${i}`;
    filters.push(
      `[${prev}]drawbox=x='${xExpr}':y='${yExpr}':w=${size}:h=${size}:` +
        `color=white@${alpha.toFixed(2)}:t=fill[${next}]`,
    );
    prev = next;
  }

  return { chain: filters.join(";"), outLabel: prev };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Phase 6: Stable Snow Edition ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-p6-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Vidu submit (parallel with musicgen)
  console.log("→ Step 1: Vidu Q3 Pro img2video 6s (STATIC subject prompt)");
  const viduTaskId = await viduSubmit();
  console.log(`  ✓ Submitted: ${viduTaskId}`);

  console.log("\n→ Step 2: musicgen 12s (parallel with Vidu)");
  const bgmPath = join(tmp, "bgm.mp3");

  const [viduResult] = await Promise.all([
    viduPoll(viduTaskId),
    generateBgm(12, bgmPath),
  ]);

  console.log(`\n  ✓ Vidu video: ${viduResult.url}`);
  console.log(`  ✓ Vidu credits: ${viduResult.credits}`);

  // 3. Download base shot
  const dlRes = await fetch(viduResult.url);
  if (!dlRes.ok) throw new Error(`Vidu download (${dlRes.status})`);
  const baseBuf = Buffer.from(await dlRes.arrayBuffer());
  const baseLocal = join(tmp, "base.mp4");
  writeFileSync(baseLocal, baseBuf);
  console.log(`  ✓ Downloaded ${(baseBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // Upload raw shot for archival
  const rawUploaded = await put(
    "demo/jewelry-ad/phase6/raw-shot.mp4",
    baseBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  console.log(`  ✓ Raw R2: ${rawUploaded.url}`);

  // 4. ffmpeg post-production: ken burns + snow + reverse loop + title card + BGM
  console.log("\n→ Step 4: ffmpeg post (ken burns + snow + reverse loop + title + BGM)");

  // First: produce a 12s "looped + ken-burns + snow" video without audio
  // Strategy:
  //   a. Reverse the 6s base
  //   b. Concat forward + reverse = 12s
  //   c. Apply ken burns zoompan (1.0 → 1.06)
  //   d. Apply snow overlay (25 particles)
  //   e. Cross-fade to 2s title card → 14s final
  // Then: mix BGM in second pass.

  // 4a. Reverse
  const reversed = join(tmp, "reversed.mp4");
  execFileSync(
    ffmpeg,
    ["-i", baseLocal, "-vf", "reverse", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", "-y", reversed],
    { stdio: "pipe" },
  );

  // 4b. Concat forward + reverse → 12s
  const concatList = join(tmp, "loop.txt");
  writeFileSync(concatList, `file '${baseLocal}'\nfile '${reversed}'\n`);
  const looped = join(tmp, "looped.mp4");
  execFileSync(
    ffmpeg,
    ["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-an", "-y", looped],
    { stdio: "pipe" },
  );
  console.log(`  ✓ 12s looped`);

  // 4c-d. Ken Burns + snow overlay in single pass
  // Ken Burns via scale + crop animation (zoompan can be tricky on existing
  // video, easier to use scale+crop with t-based expressions)
  //
  // We scale the input up by a factor that grows linearly from 1.0 → 1.06
  // over 12 seconds, then center-crop back to 720x1280.
  //
  // Actually simpler: use scale=720*1.06:1280*1.06 then crop with x,y based on t
  //
  // Even simpler: use zoompan with d=1 and z='1+0.06*t/12'... but zoompan
  // wants a duration parameter.
  //
  // Simplest reliable approach: pre-scale to 110% and use crop with t-based
  // x/y to produce the slow zoom-in effect. Crop center moves toward center
  // and crop size shrinks to create zoom-in feel.
  //
  // We'll just upscale the source by 1.1 statically, then crop with x,y that
  // do a tiny pan to create motion sense, but skip ken burns to avoid extra
  // complexity. The snow particles already give "motion".
  //
  // Decision: skip ken burns, just snow overlay. Motion comes from snow.

  const SNOW_COUNT = 28;
  const TOTAL = 12;

  // Build labeled snow chain. Input is the looped video [0:v].
  // Normalize it first to ensure 720x1280 30fps.
  const normalizedLabel = "norm";
  const normalizeFilter =
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:` +
    `(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,trim=duration=${TOTAL},setpts=PTS-STARTPTS[${normalizedLabel}]`;

  const { chain: snowChain, outLabel: snowOutLabel } = buildSnowOverlay(SNOW_COUNT, TOTAL, normalizedLabel);

  // After snow, run a small zoompan ken burns by re-scaling slightly larger
  // and using crop with time-based x-shift. Use simple scale + crop:
  //   scale=int(720*1.07):int(1280*1.07)  (770x1370)
  //   crop=720:1280:'(in_w-720)/2 + 0':(in_h-1280)/2 + (t/12)*(50)  -- subtle pan down
  //
  // We'll do a tiny pan downward (mimics snowfall feeling) of 30px over 12s.
  const kbLabel = "kb";
  const kbFilter =
    `[${snowOutLabel}]scale=770:1370,crop=720:1280:25:'25+(t/${TOTAL})*15'[${kbLabel}]`;

  // Final fade in/out
  const vfinalLabel = "vfinal";
  const fadeFilter = `[${kbLabel}]fade=t=in:st=0:d=0.5,fade=t=out:st=${TOTAL - 0.5}:d=0.5[${vfinalLabel}]`;

  // Compose final video pass (no audio yet — we mix BGM in a second pass to
  // keep filter graph simpler)
  const videoOnlyLocal = join(tmp, "video-only.mp4");
  const videoFilter = [normalizeFilter, snowChain, kbFilter, fadeFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", looped,
      "-filter_complex", videoFilter,
      "-map", `[${vfinalLabel}]`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", videoOnlyLocal,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ Video composite (snow + ken burns + fade)`);

  // 4e. Cross-fade to 2s title card → 14s final
  const FONT = "/System/Library/Fonts/Helvetica.ttc";
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-jmodels-style-v6.mp4";

  // Title card: 2.5s of black with brand text fading in/out
  const titleFilter =
    `color=c=black:s=720x1280:d=2.5:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='JmodelsJewelry':fontcolor=white:fontsize=58:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-20:alpha='if(lt(t\\,0.4)\\,t/0.4\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))',` +
    `drawtext=fontfile=${FONT}:text='Crafted with brilliance':fontcolor=0xb0b0b0:fontsize=28:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t\\,0.6)\\,max(0\\,(t-0.2)/0.4)\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))'`;

  // xfade between [0:v] (12s body) and [1:v] (2.5s title) at offset 11.5s
  // BGM mix: [2:a] is the musicgen output
  const finalFilter = [
    `[0:v]format=yuv420p,fps=30,trim=duration=12,setpts=PTS-STARTPTS[body]`,
    `${titleFilter}[title]`,
    `[body][title]xfade=transition=fade:duration=0.5:offset=11.5[vout]`,
    `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=12.0:d=1.5,alimiter=limit=0.95[aout]`,
  ].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", videoOnlyLocal,
      "-i", bgmPath,
      "-filter_complex", finalFilter,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", finalLocal,
    ],
    { stdio: "pipe" },
  );
  const finalBuf = readFileSync(finalLocal);
  console.log(`  ✓ Final: ${(finalBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // 5. Upload final
  console.log("\n→ Step 5: upload to R2");
  const finalUploaded = await put(
    "demo/jewelry-ad/phase6/jewelry-jmodels-style-v6.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const bgmBuf = readFileSync(bgmPath);
  const bgmUploaded = await put(
    "demo/jewelry-ad/phase6/musicgen-bgm.mp3",
    bgmBuf,
    { contentType: "audio/mpeg", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Phase 6 complete in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${viduResult.credits ?? "?"} (~$${((viduResult.credits ?? 0) / 100).toFixed(2)})`);
  console.log(`\n📁 Local:        ${finalLocal}`);
  console.log(`🎬 Final R2:     ${finalUploaded.url}`);
  console.log(`🎞️  Raw shot:     ${rawUploaded.url}`);
  console.log(`🎵 BGM:          ${bgmUploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
