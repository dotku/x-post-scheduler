/**
 * Jewelry ad — BLING BLING edition.
 *
 * What was missing from the previous 5 versions: sparkle accents, light sweeps,
 * and chime sound effects — the audiovisual signature of luxury jewelry ads.
 *
 * This script:
 *   1. Re-runs Wavespeed Seedance i2v with a maximum-sparkle prompt
 *   2. Layers ffmpeg post-production:
 *      - 3 animated light sweeps across the ring
 *      - Brightness/saturation pump synced with sweeps
 *      - 3 ffmpeg-synthesized chime SFX (C7-E7-G7 bell chord, exp decay)
 *      - Soft ambient pad as bed
 *      - Emerald-green brand overlays
 *   3. Uploads to R2: demo/jewelry-ad/bling/jewelry-ad-bling.mp4
 *
 * Cost: ~$0.40 (Wavespeed Seedance) + free ffmpeg.
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

if (!process.env.WAVESPEED_API_KEY) {
  console.error("ERROR: WAVESPEED_API_KEY is not set");
  process.exit(1);
}

const REFERENCE_IMAGE_URL =
  "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/polished/jewelry-reference-frame.jpg";

const BLING_PROMPT =
  "An emerald cushion-cut diamond halo ring rotates slowly with dramatic " +
  "cinematic motion. Brilliant intense diamond sparkles flash across every " +
  "single facet. Bright lens flares burst from the highlights. Magical " +
  "glowing dust particles drift gently upward through the air. Soft bokeh " +
  "light orbs float in the deep green silk background. Diagonal godrays " +
  "beam through the scene. Hyper-cinematic luxury high-jewelry advertisement, " +
  "maximum bling and sparkle effects, ultra-high contrast, photorealistic, " +
  "slow motion, 4K render, professional product video";

const FONT = "/System/Library/Fonts/Helvetica.ttc";
const BRAND = "JmodelsJewelry";
const SLOGAN = "Crafted with brilliance";
const CTA = "@jmodelsjewelry";

function escDrawtext(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// ─── Step 1: Generate sparkle-heavy video ──────────────────────────────────

async function generateBlingVideo(): Promise<string> {
  console.log("→ Step 1: Wavespeed Seedance with maximum-sparkle prompt");
  const submitted = await submitVideoTask({
    modelId: "bytedance/seedance-v1.5-pro/image-to-video",
    prompt: BLING_PROMPT,
    duration: 5,
    aspectRatio: "1:1",
    imageUrl: REFERENCE_IMAGE_URL,
  });
  const pollUrl = submitted.urls?.get || submitted.id;
  console.log(`  ✓ Submitted: ${pollUrl}`);

  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 15 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    let polled: VideoTask;
    try {
      polled = await getVideoTask(pollUrl);
    } catch (e) {
      console.log(`  ! poll error: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (polled.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${elapsed}s] status=${polled.status}`);
      lastStatus = polled.status;
    }
    if (polled.status === "completed" && polled.outputs?.[0]) {
      return polled.outputs[0];
    }
    if (polled.status === "failed") {
      throw new Error(`Wavespeed failed: ${polled.error || "unknown"}`);
    }
  }
  throw new Error("Wavespeed timed out");
}

// ─── Step 2: ffmpeg bling post-production ──────────────────────────────────

// Light sweep timing (within a 5s base video; we'll loop to 10s by playing
// forward+reverse for smoothness, then bling effects sync to the loop)
const SWEEPS = [
  { t: 0.8 }, // first reveal
  { t: 3.0 }, // mid-rotation
  { t: 5.2 }, // reverse-loop transition
  { t: 7.4 }, // second mid
];

async function main() {
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-bling-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  console.log("=== Jewelry Ad — BLING BLING edition ===\n");

  // 1. Generate
  const videoUrl = await generateBlingVideo();
  console.log(`  ✓ Video URL: ${videoUrl}`);

  console.log("\n→ Step 2: download base clip from Wavespeed");
  const dlRes = await fetch(videoUrl);
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
  const base = join(tmp, "base.mp4");
  writeFileSync(base, Buffer.from(await dlRes.arrayBuffer()));
  console.log(`  ✓ ${(readFileSync(base).length / 1024 / 1024).toFixed(2)} MB`);

  // 2. Forward + reverse to make a 10s palindrome (smoother loop, more time
  // for bling effects to play out)
  console.log("\n→ Step 3: forward+reverse loop to 10s");
  const reversed = join(tmp, "reversed.mp4");
  execFileSync(
    ffmpeg,
    ["-i", base, "-vf", "reverse", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", "-y", reversed],
    { stdio: "pipe" },
  );
  const concatList = join(tmp, "loop.txt");
  writeFileSync(concatList, `file '${base}'\nfile '${reversed}'\n`);
  const looped = join(tmp, "looped.mp4");
  execFileSync(
    ffmpeg,
    ["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-y", looped],
    { stdio: "pipe" },
  );
  console.log("  ✓ Looped");

  // 3. Generate chime SFX — 3 bell chord chimes synced to sweeps
  console.log("\n→ Step 4: synthesize 3 chime SFX (C7-E7-G7 bell chord)");
  const chime = join(tmp, "chime.wav");
  // Bell chord = high sines with exponential decay envelope
  execFileSync(
    ffmpeg,
    [
      "-f", "lavfi", "-i", "sine=frequency=2093:duration=1.2", // C7
      "-f", "lavfi", "-i", "sine=frequency=2637:duration=1.2", // E7
      "-f", "lavfi", "-i", "sine=frequency=3136:duration=1.2", // G7
      "-filter_complex",
      "[0][1][2]amix=inputs=3:duration=longest,volume=0.6,afade=t=out:st=0.05:d=1.1:curve=exp[c]",
      "-map", "[c]",
      "-y", chime,
    ],
    { stdio: "pipe" },
  );
  console.log("  ✓ Chime");

  // 4. Composite final: light sweeps + brand text + chime + ambient pad
  console.log("\n→ Step 5: composite bling overlays + audio mix");
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-ad-bling.mp4";

  // Build video filter chain:
  //   - 3-4 animated light sweeps using drawbox (white vertical band sliding
  //     diagonally with low alpha — gives a "shimmer pass" feeling)
  //   - brightness pump synced to each sweep
  //   - bottom emerald brand text
  // We use [v0]→[v1]→[v2]... labeled chains so commas in filter args don't bite
  const chains: string[] = [];
  let prev = "0:v";
  let n = 0;

  // Light sweep: a soft white diagonal band moving across the frame
  // Each sweep lasts 0.8s. drawbox y=0 covers full height. x animates with `t`.
  for (const sweep of SWEEPS) {
    n++;
    const start = sweep.t;
    const end = sweep.t + 0.8;
    // x position: starts left (-200), moves to right (w+200) over the duration
    // x = -200 + (t-start)/0.8 * (W+400)
    // For 1080w: x = -200 + (t-start) * 1850
    const xExpr = `-200+(t-${start})*1850`;
    const filter = [
      `drawbox=x='${xExpr}'`,
      `y=0`,
      `w=120`,
      `h=ih`,
      `color=white@0.18`,
      `t=fill`,
      `enable='between(t\\,${start}\\,${end})'`,
    ].join(":");
    const next = `vs${n}`;
    chains.push(`[${prev}]${filter}[${next}]`);
    prev = next;
  }

  // Brightness pump synced to each sweep moment (eq filter)
  for (const sweep of SWEEPS) {
    n++;
    const start = sweep.t;
    const end = sweep.t + 0.6;
    const filter = `eq=brightness=0.08:saturation=1.15:contrast=1.08:enable='between(t\\,${start}\\,${end})'`;
    const next = `vs${n}`;
    chains.push(`[${prev}]${filter}[${next}]`);
    prev = next;
  }

  // Brand text: top brand name + bottom rotating slogan/CTA
  n++;
  chains.push(
    `[${prev}]drawtext=fontfile=${FONT}:text='${escDrawtext(BRAND)}':fontcolor=white:fontsize=58:box=1:boxcolor=black@0.5:boxborderw=20:x=(w-text_w)/2:y=60:enable='between(t\\,0.3\\,3.5)'[vs${n}]`,
  );
  prev = `vs${n}`;

  n++;
  chains.push(
    `[${prev}]drawtext=fontfile=${FONT}:text='${escDrawtext(SLOGAN)}':fontcolor=white:fontsize=44:box=1:boxcolor=0x10b981@0.85:boxborderw=18:x=(w-text_w)/2:y=h-160:enable='between(t\\,3.6\\,7.4)'[vs${n}]`,
  );
  prev = `vs${n}`;

  n++;
  chains.push(
    `[${prev}]drawtext=fontfile=${FONT}:text='${escDrawtext(CTA)}':fontcolor=white:fontsize=44:box=1:boxcolor=0x10b981@0.85:boxborderw=18:x=(w-text_w)/2:y=h-160:enable='between(t\\,7.6\\,9.7)'[vs${n}]`,
  );
  prev = `vs${n}`;

  // Final fade in/out
  n++;
  chains.push(`[${prev}]fade=t=in:st=0:d=0.4,fade=t=out:st=9.6:d=0.4[vout]`);

  // Audio: 4 chime triggers (delay each by sweep.t * 1000ms) + ambient pad
  // Inputs (0-indexed in ffmpeg cmdline):
  //   0: looped video
  //   1: chime.wav
  //   2: chime.wav
  //   3: chime.wav
  //   4: chime.wav
  //   5,6,7: lavfi sine pads
  const audioParts: string[] = [];
  SWEEPS.forEach((sweep, i) => {
    const delayMs = Math.round(sweep.t * 1000);
    audioParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},volume=0.7[ch${i}]`);
  });
  audioParts.push(
    `[5:a][6:a][7:a]amix=inputs=3:duration=first,volume=0.30,lowpass=f=900,afade=t=in:d=1.5:curve=qsin,afade=t=out:st=8.5:d=1.5:curve=qsin[pad]`,
  );
  audioParts.push(
    `[ch0][ch1][ch2][ch3][pad]amix=inputs=5:duration=longest:dropout_transition=0,alimiter=limit=0.95[aout]`,
  );

  const filterComplex = `${chains.join(";")};${audioParts.join(";")}`;

  execFileSync(
    ffmpeg,
    [
      "-i", looped,
      "-i", chime, "-i", chime, "-i", chime, "-i", chime,
      "-f", "lavfi", "-t", "10", "-i", "sine=frequency=261.63",
      "-f", "lavfi", "-t", "10", "-i", "sine=frequency=329.63",
      "-f", "lavfi", "-t", "10", "-i", "sine=frequency=392.00",
      "-filter_complex", filterComplex,
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
  console.log(`  ✓ Final: ${(finalBuf.length / 1024 / 1024).toFixed(2)} MB → ${finalLocal}`);

  // 5. Upload
  console.log("\n→ Step 6: upload to R2");
  const uploaded = await put(
    "demo/jewelry-ad/bling/jewelry-ad-bling.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  console.log(`  ✓ R2: ${uploaded.url}`);

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Bling edition done in ${totalSec}s`);
  console.log("========================================");
  console.log(`📁 Local:  ${finalLocal}`);
  console.log(`🎬 R2:     ${uploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2000 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2000));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
