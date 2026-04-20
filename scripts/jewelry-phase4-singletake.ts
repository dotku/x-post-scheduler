/**
 * Phase 4: Single-Take JmodelsJewelry-style ad.
 *
 * KEY INSIGHT from analyzing JmodelsJewelry's actual TikTok videos:
 * 4 out of 6 videos have ZERO scene cuts (12-21s single continuous shots).
 * Our Phase 2 with 4 hard-cut shots was the WRONG model — it's actually
 * the LEAST representative of their style.
 *
 * v4 strategy: ONE long continuous shot of the SAME ring.
 *
 *   1. Dreamina 3.1 generates a master reference image of the exact ring
 *      we want, with 9:16 aspect, black backdrop, dramatic single key light.
 *   2. Vidu Q3 Pro img2video runs ONE 10-second shot using that image as
 *      the starting frame, with a complex elaborate camera move prompt
 *      (slow dolly back + rotation + tilt). This guarantees the same
 *      jewelry throughout because there are no cuts.
 *   3. Append a 2-second brand title card (ffmpeg drawtext fade-in).
 *   4. Mix in cinematic BGM (Replicate musicgen).
 *
 * Total cost: ~$2.60. Total time: ~5 min.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { submitImageTask, getVideoTask, type VideoTask } from "../lib/wavespeed";
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
  console.error("ERROR: REPLICATE_API_KEY is not set");
  process.exit(1);
}

const VIDU_BASE = "https://api.vidu.com/ent/v2";

// ─── Step 1: Master reference image (Dreamina 3.1, premium aesthetic) ──────

const REFERENCE_PROMPT =
  "Ultra-photorealistic luxury jewelry product shot. A magnificent emerald " +
  "cushion-cut diamond halo ring on a polished platinum split-shank band. " +
  "The central emerald is 5 carats, deep saturated green with perfect " +
  "octagonal cushion cut, rich vivid color, internal facet refractions visible. " +
  "Surrounding the emerald is a halo of 16 round brilliant diamonds in " +
  "double-prong settings. The split-shank band has tiny pavé diamonds along " +
  "its length. The ring sits perfectly centered on a deep black polished " +
  "acrylic surface that creates a flawless mirror reflection beneath. " +
  "Single dramatic key light from above-left at 45 degrees creates strong " +
  "chiaroscuro lighting and bright spectral highlights on every diamond facet. " +
  "Pure black background with deep shadow falloff. Hyper-detailed metalwork " +
  "with visible micro-engraving on the prongs. Studio jewelry photography, " +
  "8K commercial quality, ARRI Alexa LF aesthetic, ProRes 4444 grade, " +
  "tack-sharp focus on the central emerald, photorealistic, hyper-luxury " +
  "high-jewelry brand. Vertical 9:16 composition.";

async function generateReferenceImage(): Promise<string> {
  console.log("→ Step 1: generate master reference image (Dreamina 3.1)");

  const task = await submitImageTask({
    modelId: "bytedance/dreamina-v3.1/text-to-image",
    prompt: REFERENCE_PROMPT,
    mode: "t2i",
    aspectRatio: "9:16",
  });
  const pollUrl = task.urls?.get || task.id;
  console.log(`  ✓ Submitted: ${pollUrl}`);

  const startedAt = Date.now();
  const TIMEOUT = 5 * 60 * 1000;
  let imageUrl: string | undefined;
  while (Date.now() - startedAt < TIMEOUT) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const polled = await getVideoTask(pollUrl);
      if (polled.status === "completed" && polled.outputs?.[0]) {
        imageUrl = polled.outputs[0];
        break;
      }
      if (polled.status === "failed") {
        throw new Error("Image generation failed");
      }
    } catch (e) {
      console.log(`  ! poll error: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!imageUrl) throw new Error("Image timed out");

  console.log(`  ✓ Generated: ${imageUrl}`);

  // Mirror to R2 (Wavespeed URLs may be ephemeral, and Vidu needs a stable
  // public URL to fetch the reference image).
  const dlRes = await fetch(imageUrl);
  if (!dlRes.ok) throw new Error(`Failed to download: ${dlRes.status}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  console.log(`  ✓ Downloaded ${(buf.length / 1024).toFixed(0)} KB`);

  const uploaded = await put(
    "demo/jewelry-ad/phase4/master-reference.png",
    buf,
    { contentType: "image/png", addRandomSuffix: false },
  );
  console.log(`  ✓ R2: ${uploaded.url}`);
  return uploaded.url;
}

// ─── Step 2: Single-take Vidu Q3 Pro img2video ─────────────────────────────

const SINGLE_TAKE_MOTION_PROMPT =
  "A single continuous cinematic shot of this exact emerald diamond ring. " +
  "The camera begins extreme close-up on the central emerald gem showing its " +
  "internal facets refracting light, then very slowly dollies backward over " +
  "the entire duration while gently rotating clockwise around the ring, " +
  "revealing more and more of the surrounding diamond halo and the platinum " +
  "band. As the camera moves, each diamond facet catches the dramatic key " +
  "light and emits brilliant rainbow starburst highlights — intense lens " +
  "flares, light spikes, and prismatic refractions dance across the entire " +
  "ring. The reflection beneath shimmers with subtle bokeh particles. Pure " +
  "black background remains constant. Slow elegant deliberate motion, no " +
  "cuts, single continuous camera move. Hyper-cinematic ARRI Alexa LF " +
  "aesthetic, ProRes 4444 grade, slow motion 30fps, photorealistic luxury " +
  "high-jewelry brand commercial.";

async function viduSubmit(referenceUrl: string): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/img2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      images: [referenceUrl],
      prompt: SINGLE_TAKE_MOTION_PROMPT,
      duration: 10,
      aspect_ratio: "9:16",
      resolution: "720p",
      movement_amplitude: "small", // controlled deliberate motion
      audio: false,
    }),
  });
  if (!res.ok) throw new Error(`Vidu submit failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { task_id: string };
  return data.task_id;
}

async function viduPoll(taskId: string): Promise<{ url: string; credits?: number }> {
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
      console.log(`  [${elapsed}s] state=${data.state}`);
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

// ─── Step 3: Replicate musicgen (12s cinematic) ────────────────────────────

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MUSIC_PROMPT =
  "Ultra-slow cinematic luxury brand commercial soundtrack, 70 BPM, soft " +
  "intimate piano with shimmering crystalline chimes that ring out gently, " +
  "deep velvety cinematic ambient bass swell building from silence to a " +
  "peak then falling away, sparse delicate bell tones, emotional aspirational " +
  "mood, hyper-minimal modern production, no drums, no vocals, designed " +
  "for a high-end jewelry brand commercial like Cartier or Bulgari";

async function generateBgm(durationSec: number, outPath: string): Promise<void> {
  console.log(`→ Step 3: musicgen ${durationSec}s`);
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
  console.log(`  ✓ Submitted: ${submitData.id}`);

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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Phase 4: Single-Take Jewelry Ad (JModels-style) ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "jewelry-p4-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Master reference image
  const referenceUrl = await generateReferenceImage();

  // 2. Single-take Vidu shot (start as soon as image is ready)
  console.log("\n→ Step 2: Vidu Q3 Pro img2video 10s (single take)");
  const viduTaskId = await viduSubmit(referenceUrl);
  console.log(`  ✓ Submitted: ${viduTaskId}`);

  // Run musicgen in parallel with Vidu (independent inputs)
  const bgmPath = join(tmp, "bgm.mp3");

  // Wait for Vidu and musicgen in parallel
  const [viduResult] = await Promise.all([
    viduPoll(viduTaskId),
    generateBgm(12, bgmPath),
  ]);

  console.log(`\n  ✓ Vidu video: ${viduResult.url}`);
  console.log(`  ✓ Vidu credits: ${viduResult.credits}`);

  // 3. Download Vidu video
  const dlRes = await fetch(viduResult.url);
  if (!dlRes.ok) throw new Error(`Vidu download failed: ${dlRes.status}`);
  const viduBuf = Buffer.from(await dlRes.arrayBuffer());
  const viduLocal = join(tmp, "vidu-shot.mp4");
  writeFileSync(viduLocal, viduBuf);
  console.log(`  ✓ Downloaded ${(viduBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // Upload raw shot to R2 for archival
  const shotUploaded = await put(
    "demo/jewelry-ad/phase4/single-take-shot.mp4",
    viduBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  console.log(`  ✓ Shot R2: ${shotUploaded.url}`);

  // 4. Compose: 10s shot + 2s brand title card + BGM
  console.log("\n→ Step 4: compose 12s final (shot + 2s title card + BGM)");

  // Build a single ffmpeg pass with:
  //   - Vidu shot (10s)
  //   - 2s of black with brand name fading in (title card)
  //   - cross-fade from shot to title card
  //   - BGM mixed underneath both
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/jewelry-jmodels-style-v4.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Filter strategy:
  //   - [0:v] is the 10s Vidu shot, normalize to 720x1280 30fps
  //   - Generate 2s of black (lavfi color) for title card
  //   - drawtext brand name on title card with fade in
  //   - Concat with xfade transition
  //   - Audio: just BGM with proper fade

  // Title card prep: lavfi color source 2s black + drawtext
  const titleFilter =
    `color=c=black:s=720x1280:d=2.5:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='JmodelsJewelry':fontcolor=white:fontsize=58:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-20:alpha='if(lt(t,0.4),t/0.4,if(gt(t,2.0),max(0,1-(t-2.0)/0.4),1))',` +
    `drawtext=fontfile=${FONT}:text='Crafted with brilliance':fontcolor=0xb0b0b0:fontsize=28:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t,0.6),max(0,(t-0.2)/0.4),if(gt(t,2.0),max(0,1-(t-2.0)/0.4),1))'`;

  // Main filter graph:
  //   [0:v] Vidu shot → normalize → fade out at end
  //   lavfi title → 2s
  //   xfade between them
  const filterComplex = [
    // Normalize Vidu shot
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,trim=duration=10,setpts=PTS-STARTPTS[shot]`,
    // Title card
    `${titleFilter}[title]`,
    // xfade between shot and title (cross-fade over 0.5s starting at shot end - 0.5)
    `[shot][title]xfade=transition=fade:duration=0.5:offset=9.5[vout]`,
    // Audio: bgm with fades
    `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=10.5:d=1.5,alimiter=limit=0.95[aout]`,
  ].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", viduLocal,
      "-i", bgmPath,
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
  console.log(`  ✓ Final: ${(finalBuf.length / 1024 / 1024).toFixed(2)} MB`);

  // 5. Upload final
  console.log("\n→ Step 5: upload to R2");
  const finalUploaded = await put(
    "demo/jewelry-ad/phase4/jewelry-jmodels-style-v4.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const bgmBuf = readFileSync(bgmPath);
  const bgmUploaded = await put(
    "demo/jewelry-ad/phase4/musicgen-bgm.mp3",
    bgmBuf,
    { contentType: "audio/mpeg", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Phase 4 complete in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${viduResult.credits ?? "?"} (~$${((viduResult.credits ?? 0) / 100).toFixed(2)})`);
  console.log(`\n📁 Local:        ${finalLocal}`);
  console.log(`🎬 Final R2:     ${finalUploaded.url}`);
  console.log(`📷 Reference:    ${referenceUrl}`);
  console.log(`🎞️  Raw shot:     ${shotUploaded.url}`);
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
