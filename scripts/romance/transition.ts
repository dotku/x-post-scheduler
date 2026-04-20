/**
 * Romance Anime — "New Semester Begins" transition scene
 *
 * Inserts a 6s establishing shot between clip 001 (elderly Kenji's flashback
 * trigger) and clip 002 (the dance class meeting). Shows a beautiful
 * university campus on the first day of fall semester: cherry blossoms or
 * autumn leaves drifting, students walking with backpacks, the clock tower
 * or main building bathed in golden light.
 *
 * Final assembly:
 *   Clip 001 (10s) → white flash → Transition (6s) → cross-fade → Clip 002
 *   (20s) → end card (2s)  ≈ 38s total
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../../lib/r2";
import { submitImageTask, getVideoTask } from "../../lib/wavespeed";
import { writeFileSync, readFileSync, mkdtempSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDU_KEY = process.env.VIDU_API_KEY!;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY!;
const VIDU_BASE = "https://api.vidu.com/ent/v2";

const CLIP_001 = "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-clip001.mp4";
const CLIP_002 = "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
for (const p of [CLIP_001, CLIP_002]) {
  if (!existsSync(p)) throw new Error(`Missing: ${p}`);
}

// ─── Transition scene prompts ──────────────────────────────────────────────

const TRANSITION_PROMPT =
  "A breathtaking establishing shot of a beautiful European university " +
  "campus on the first day of the new autumn semester. A grand old stone " +
  "building with arched windows and a tall clock tower stands in golden " +
  "morning sunlight. Wide cobblestone walkways lined with tall maple and " +
  "oak trees in vibrant orange and yellow autumn foliage. Students in " +
  "casual sweaters and cardigans walk along the paths carrying books and " +
  "backpacks, some chatting in small groups. Autumn leaves drift gently " +
  "through the air. A warm golden hour glow bathes everything. Soft light " +
  "rays filter through the trees. Background bokeh of distant students. " +
  "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic " +
  "lighting, painterly volumetric god-rays, vibrant saturated autumn " +
  "colors, lens flare, dreamy nostalgic atmosphere, hyper-detailed " +
  "background art reminiscent of Your Name and Weathering With You, " +
  "Studio Ghibli influenced, vertical 9:16 cinematic composition.";

const TRANSITION_MOTION =
  "Slow elegant cinematic camera tilt down from the top of the clock tower " +
  "and arched windows of the grand stone building, slowly revealing the " +
  "tree-lined cobblestone walkways below where students are walking to " +
  "their first class of the semester. Autumn leaves drift gently from " +
  "upper-right to lower-left throughout the entire shot. Warm golden " +
  "morning light rays filter through the colorful maple trees. Students " +
  "walk slowly along the path. Single continuous shot, no cuts, smooth " +
  "deliberate motion.";

// ─── Steps ──────────────────────────────────────────────────────────────────

async function generateKeyframe(): Promise<string> {
  console.log("→ keyframe (campus first day of semester)");
  const task = await submitImageTask({
    modelId: "bytedance/seedream-v4.5",
    prompt: TRANSITION_PROMPT,
    mode: "t2i",
    aspectRatio: "9:16",
  });
  const pollUrl = task.urls?.get || task.id;
  const startedAt = Date.now();
  let imageUrl: string | undefined;
  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const polled = await getVideoTask(pollUrl);
      if (polled.status === "completed" && polled.outputs?.[0]) {
        imageUrl = polled.outputs[0];
        break;
      }
      if (polled.status === "failed") throw new Error("image gen failed");
    } catch (e) {
      console.log(`  ! ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!imageUrl) throw new Error("image timed out");
  const dl = await fetch(imageUrl);
  const buf = Buffer.from(await dl.arrayBuffer());
  const uploaded = await put(
    "demo/romance-anime/transition/transition-keyframe.png",
    buf,
    { contentType: "image/png", addRandomSuffix: false },
  );
  console.log(`  ✓ ${uploaded.url}`);
  return uploaded.url;
}

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
      prompt: TRANSITION_MOTION,
      duration: 8,
      aspect_ratio: "9:16",
      resolution: "720p",
      movement_amplitude: "small",
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
      console.log(`  [vidu|${elapsed}s] ${data.state}`);
      lastState = data.state;
    }
    if (data.state === "success" && data.creations?.[0]) {
      return { url: data.creations[0].url, credits: data.credits };
    }
    if (data.state === "failed") throw new Error(`Vidu failed: ${data.err_code}`);
  }
  throw new Error("Vidu timed out");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Transition Scene + Re-assembly ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-trans-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Generate keyframe
  const keyframeUrl = await generateKeyframe();

  // 2. Submit Vidu shot
  console.log("\n→ Vidu submit");
  const taskId = await viduSubmit(keyframeUrl);
  console.log(`  ✓ ${taskId}`);

  // 3. Poll
  const shotResult = await viduPoll(taskId);
  console.log(`  ✓ shot: ${shotResult.credits} cr`);

  // 4. Download
  const dlRes = await fetch(shotResult.url);
  const shotBuf = Buffer.from(await dlRes.arrayBuffer());
  const shotLocal = join(tmp, "transition-shot.mp4");
  writeFileSync(shotLocal, shotBuf);
  console.log(`  ✓ ${(shotBuf.length / 1024 / 1024).toFixed(2)} MB`);
  await put(
    "demo/romance-anime/transition/transition-shot.mp4",
    shotBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  // 5. Build standalone transition clip (8s with title overlay)
  console.log("\n→ ffmpeg: standalone transition + full re-assembly");

  const transitionLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-transition.mp4";
  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-full-v2.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Standalone transition: 8s shot with "A NEW SEMESTER BEGINS" title that
  // fades in around 1s and fades out around 6s. Silent (no audio).
  const standaloneFilter =
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS,` +
    `drawtext=fontfile=${FONT}:text='A NEW SEMESTER BEGINS':fontcolor=white:fontsize=52:` +
    `x=(w-text_w)/2:y=h-300:` +
    `box=1:boxcolor=black@0.45:boxborderw=24:` +
    `alpha='if(lt(t,1.0),0,if(lt(t,1.6),(t-1.0)/0.6,if(gt(t,6.0),max(0,1-(t-6.0)/0.8),1)))',` +
    `fade=t=in:st=0:d=0.8,fade=t=out:st=7.2:d=0.8[vt]`;

  execFileSync(
    ffmpeg,
    [
      "-i", shotLocal,
      "-filter_complex", standaloneFilter,
      "-map", "[vt]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-an",
      "-y", transitionLocal,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ transition: ${(readFileSync(transitionLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 6. Full re-assembly: clip001 (10s) + transition (8s with title) + clip002 (20s) + end card (2s)
  // Use xfade fadewhite between clip001→transition (memory dissolve) and
  // simple xfade fade between transition→clip002.
  // End card concatenated at the end with 2s.
  //
  // Inputs: 0=clip001, 1=transition shot (raw, no title), 2=clip002

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vendC]`;

  // Normalize all three clips
  const norm0 = `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c001v]`;

  // Transition with title text overlay (re-applied here so the title is part
  // of the assembly, not just the standalone)
  const norm1 =
    `[1:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS,` +
    `drawtext=fontfile=${FONT}:text='A NEW SEMESTER BEGINS':fontcolor=white:fontsize=52:` +
    `x=(w-text_w)/2:y=h-300:` +
    `box=1:boxcolor=black@0.45:boxborderw=24:` +
    `alpha='if(lt(t,1.0),0,if(lt(t,1.6),(t-1.0)/0.6,if(gt(t,6.0),max(0,1-(t-6.0)/0.8),1)))'[transV]`;

  const norm2 = `[2:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c002v]`;

  // xfade chain:
  //   clip001 (10s) ⟶ fadewhite ⟶ transition (8s) at offset 9.2 (0.8s overlap)
  //     resulting timeline length: 10 + 8 - 0.8 = 17.2s
  //   then ⟶ fade ⟶ clip002 (20s) at offset 16.4 (0.8s overlap)
  //     resulting timeline length: 17.2 + 20 - 0.8 = 36.4s
  //   then concat end card (2s)
  const xfade1 = `[c001v][transV]xfade=transition=fadewhite:duration=0.8:offset=9.2[xa]`;
  const xfade2 = `[xa][c002v]xfade=transition=fade:duration=0.8:offset=16.4[xb]`;
  const concatEnd = `[xb][vendC]concat=n=2:v=1:a=0[vfullout]`;

  // Audio:
  //   [0:a] = clip001 audio (10s)
  //   [2:a] = clip002 audio (20s)
  //   The transition (8s) has no audio of its own — bridge the silence with
  //   a gentle fade between the two.
  // Strategy: clip001 audio → 8s of silence (transition) → clip002 audio.
  // BUT timeline has the xfades shortening clip001 by 0.8 and shortening
  // clip002 by 0.8 overlap. We approximate by keeping clip001 audio at full
  // 10s, then 7.2s silence (transition - 0.8 - 0.8 audio handoff), then
  // clip002 audio. We crossfade the seams.
  //
  // Simpler: take clip001 audio, fade out at end. Then clip002 audio fades
  // in. The transition is essentially silent (BGM dies down for the
  // establishing shot, which is fine — heightens the mood).
  const audioFilter =
    `[0:a]afade=t=out:st=8.5:d=1.5,apad=pad_dur=8[a001P];` +
    `[2:a]afade=t=in:st=0:d=1.5,apad=pad_dur=2[a002P];` +
    `[a001P][a002P]concat=n=2:v=0:a=1,alimiter=limit=0.97[afullout]`;

  const fullFilter = [norm0, norm1, norm2, xfade1, xfade2, endFilter, concatEnd, audioFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", CLIP_001,
      "-i", shotLocal,
      "-i", CLIP_002,
      "-filter_complex", fullFilter,
      "-map", "[vfullout]",
      "-map", "[afullout]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", finalLocal,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ full: ${(readFileSync(finalLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 7. Upload
  console.log("\n→ upload");
  const transUp = await put(
    "demo/romance-anime/transition/romance-anime-transition.mp4",
    readFileSync(transitionLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const fullUp = await put(
    "demo/romance-anime/full/romance-anime-full-v2.mp4",
    readFileSync(finalLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${shotResult.credits} (~$${((shotResult.credits ?? 0) / 100).toFixed(2)})`);
  console.log(`\n📁 Transition: ${transitionLocal}`);
  console.log(`📁 Full v2:    ${finalLocal}`);
  console.log(`🎬 Trans R2:   ${transUp.url}`);
  console.log(`🎬 Full v2 R2: ${fullUp.url}`);
  console.log(`📷 Keyframe:   ${keyframeUrl}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
