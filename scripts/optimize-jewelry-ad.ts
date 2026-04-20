/**
 * Path A: ffmpeg-only polish of public/videos/433ba57413a75c76d719d37f696ac66f.mp4
 *
 * Input: 720x720, 12 fps, 10.08s, mono audio, AI watermark in top-left.
 * Output: 1080x1080, 30 fps, 20s (forward + reverse), brand text + ambient BGM,
 *         AI watermark cropped+scaled out, written to:
 *           public/videos/jewelry-ad-polished.mp4
 *           R2: demo/jewelry-ad/polished/jewelry-ad-polished.mp4
 *
 * No paid APIs. ffmpeg only. Free.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { readFileSync, writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const SOURCE = "/Users/wlin/dev/x-post-scheduler/public/videos/433ba57413a75c76d719d37f696ac66f.mp4";
const OUTPUT_LOCAL = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-ad-polished.mp4";

const FONT = "/System/Library/Fonts/Helvetica.ttc";

// Brand overlays — placeholder defaults; client can rebrand
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

async function main() {
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-polish-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  console.log("=== Jewelry Ad — Path A (ffmpeg polish) ===\n");

  // ── Step 1: Pre-process — crop AI watermark + frame interpolate + upscale ──
  // The AI badge is in the top-left corner. Crop ~60px from top + left, then
  // pad/scale back to square. Combined with 12→30fps minterpolate and lanczos
  // upscale to 1080x1080 in one pass.
  console.log("→ Step 1: crop watermark + interpolate 12→30fps + upscale to 1080");
  const cleaned = join(tmp, "cleaned.mp4");

  // Crop strategy: crop from (60, 60) keeping a 660x660 square, then scale to 1080.
  // This removes the top-left "AI" badge while keeping the ring centered.
  execFileSync(
    ffmpeg,
    [
      "-i", SOURCE,
      "-vf",
      [
        "crop=660:660:60:60",
        "scale=1080:1080:flags=lanczos",
        // Frame interpolate 12 -> 30 fps using motion-compensated interpolation
        "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
        // Color grade: bump saturation and contrast for jewelry sparkle
        "eq=saturation=1.18:contrast=1.08:brightness=0.02",
      ].join(","),
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-an",
      "-y", cleaned,
    ],
    { stdio: "pipe" },
  );
  console.log("  ✓ Cleaned");

  // ── Step 2: Loop forward + reverse → ~20s seamless loop ────────────────────
  // Forward 10s + reverse 10s = 20s palindrome that loops without seams
  console.log("\n→ Step 2: forward+reverse loop (20s palindrome)");
  const reversed = join(tmp, "reversed.mp4");
  execFileSync(
    ffmpeg,
    ["-i", cleaned, "-vf", "reverse", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-y", reversed],
    { stdio: "pipe" },
  );

  const concatList = join(tmp, "loop.txt");
  writeFileSync(concatList, `file '${cleaned}'\nfile '${reversed}'\n`);
  const looped = join(tmp, "looped.mp4");
  execFileSync(
    ffmpeg,
    ["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-y", looped],
    { stdio: "pipe" },
  );
  console.log("  ✓ Looped to 20s");

  // ── Step 3: Brand overlay + fade in/out + ambient BGM in single pass ──────
  console.log("\n→ Step 3: brand overlay + fade + BGM mix");

  // Overlay timeline (20s total):
  //   0–4s   Brand: "JmodelsJewelry" (top, large)
  //   4–14s  Slogan: "Crafted with brilliance" (bottom, emerald box)
  //  14–20s  CTA: "@jmodelsjewelry" (bottom, emerald box)
  const drawtextChain = [
    `[0:v]drawtext=fontfile=${FONT}:text='${escDrawtext(BRAND)}':fontcolor=white:fontsize=64:box=1:boxcolor=black@0.45:boxborderw=22:x=(w-text_w)/2:y=70:enable='between(t\\,0.5\\,3.8)'[v1]`,
    `[v1]drawtext=fontfile=${FONT}:text='${escDrawtext(SLOGAN)}':fontcolor=white:fontsize=48:box=1:boxcolor=0x10b981@0.85:boxborderw=20:x=(w-text_w)/2:y=h-180:enable='between(t\\,4\\,13.8)'[v2]`,
    `[v2]drawtext=fontfile=${FONT}:text='${escDrawtext(CTA)}':fontcolor=white:fontsize=48:box=1:boxcolor=0x10b981@0.85:boxborderw=20:x=(w-text_w)/2:y=h-180:enable='between(t\\,14\\,19.5)'[v3]`,
    `[v3]fade=t=in:st=0:d=0.6,fade=t=out:st=19.4:d=0.6[vout]`,
  ].join(";");

  // Audio: soft C-major triad pad (C4, E4, G4) lowpass filtered + fade
  const audioChain = [
    `[1:a][2:a][3:a]amix=inputs=3:duration=first,volume=0.35,lowpass=f=900,afade=t=in:st=0:d=2:curve=qsin,afade=t=out:st=18:d=2:curve=qsin,alimiter=limit=0.95[aout]`,
  ].join(";");

  const finalLocal = OUTPUT_LOCAL;
  execFileSync(
    ffmpeg,
    [
      "-i", looped,
      "-f", "lavfi", "-t", "20", "-i", "sine=frequency=261.63",
      "-f", "lavfi", "-t", "20", "-i", "sine=frequency=329.63",
      "-f", "lavfi", "-t", "20", "-i", "sine=frequency=392.00",
      "-filter_complex", `${drawtextChain};${audioChain}`,
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

  // ── Step 4: Upload to R2 ───────────────────────────────────────────────────
  console.log("\n→ Step 4: upload to R2");
  const uploaded = await put(
    "demo/jewelry-ad/polished/jewelry-ad-polished.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  console.log(`  ✓ R2: ${uploaded.url}`);

  // ── Also extract first frame for re-use as reference image in B/C/D/E ─────
  console.log("\n→ Bonus: extract first frame for use as reference in next paths");
  const firstFrame = join("/Users/wlin/dev/x-post-scheduler/public/videos", "jewelry-reference-frame.jpg");
  execFileSync(
    ffmpeg,
    ["-ss", "0", "-i", cleaned, "-frames:v", "1", "-q:v", "2", "-y", firstFrame],
    { stdio: "pipe" },
  );
  const frameBuf = readFileSync(firstFrame);
  const frameUploaded = await put(
    "demo/jewelry-ad/polished/jewelry-reference-frame.jpg",
    frameBuf,
    { contentType: "image/jpeg", addRandomSuffix: false },
  );
  console.log(`  ✓ Reference frame R2: ${frameUploaded.url}`);

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Path A done in ${totalSec}s`);
  console.log("========================================");
  console.log(`📁 Local:           ${finalLocal}`);
  console.log(`🎬 Polished video:  ${uploaded.url}`);
  console.log(`🖼  Reference frame: ${frameUploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr:");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2000));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
