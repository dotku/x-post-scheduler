/**
 * Romance Anime — Clip 001 (Hook) + final assembly with Clip 002
 *
 * Hook scene: An elderly Asian man (aged Kenji) in a sunlit nursing home
 * room, slowly turning the pages of an old photo album. On the open page is
 * a young photograph of his late wife (young Emma). His weathered fingers
 * trace the photo. A single tear rolls down his cheek as the room dissolves
 * around him into a flashback...
 *
 * Then the existing Clip 002 (romance-anime-v2.mp4) plays as the memory.
 *
 * Pipeline:
 *   1. Wavespeed seedream-v4.5 → keyframe (old Kenji w/ photo album)
 *   2. Vidu Q3 Pro img2video → 8s shot
 *   3. Replicate kokoro TTS → hook narration
 *   4. Replicate musicgen → 12s melancholic-then-warm piano intro
 *   5. ffmpeg compose:
 *        2s opening title
 *        + 8s hook shot (with narration + intro BGM)
 *        + 1s white flash transition
 *        + 20s existing clip 002 (romance-anime-v2.mp4 as-is, audio kept)
 *        + 2s end card
 *      Total: ~33s
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
if (!VIDU_KEY) throw new Error("VIDU_API_KEY not set");
if (!process.env.WAVESPEED_API_KEY) throw new Error("WAVESPEED_API_KEY not set");
if (!REPLICATE_KEY) throw new Error("REPLICATE_API_KEY not set");

const VIDU_BASE = "https://api.vidu.com/ent/v2";
const CLIP_002_PATH =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
if (!existsSync(CLIP_002_PATH)) {
  throw new Error(`Clip 002 not found at ${CLIP_002_PATH}. Run v2 first.`);
}

// ─── Keyframe + motion prompt ──────────────────────────────────────────────

const HOOK_PROMPT =
  "An elderly Asian man in his 80s, with neatly combed silver-grey hair, " +
  "thin silver wire-frame glasses (the same style he wore his whole life), " +
  "deep gentle wrinkles around warm brown eyes, fair warm-toned skin, " +
  "wearing a soft beige cardigan over a white collared shirt, sitting " +
  "alone in a wooden chair by a tall arched window in a quiet nursing home " +
  "room. Late afternoon golden sunlight pours through the window, painting " +
  "the room in warm honey tones. On his lap rests an open old leather " +
  "photo album. Visible on the open page is a small black-and-white " +
  "photograph of a young Caucasian European woman in her early twenties, " +
  "with long wavy strawberry-blonde hair, soft grey-blue eyes, light " +
  "freckles across her nose, gentle smile, wearing a vintage cream " +
  "cardigan and a small ribbon at the collar. The old man's weathered " +
  "fingers gently rest on the photograph. A single tear glistens at the " +
  "corner of his eye. Soft floating dust particles drift in the sunbeams. " +
  "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic " +
  "lighting, painterly volumetric god-rays, warm golden-hour glow, vibrant " +
  "saturated colors, lens flare, dreamy melancholic atmosphere, " +
  "hyper-detailed background art reminiscent of Your Name and Weathering " +
  "With You, Studio Ghibli influenced, vertical 9:16 cinematic composition.";

const HOOK_MOTION =
  "Slow gentle camera dolly forward toward the elderly man sitting by the " +
  "window. He slowly turns one page of the photo album with his weathered " +
  "fingers. His eyes settle on the young woman's photograph. His gaze " +
  "softens with a faint trembling smile. A single tear glistens and rolls " +
  "down his cheek. Sunlight rays drift gently through the window, dust " +
  "particles floating in the warm golden light. Single continuous shot, no " +
  "cuts, slow deliberate emotional motion.";

const NARRATION =
  "Sixty years ago, on the first day of a new semester... I met the girl " +
  "who would change everything.";

// ─── Step 1: keyframe ──────────────────────────────────────────────────────

async function generateKeyframe(): Promise<string> {
  console.log("→ keyframe (old Kenji + photo of young Emma)");
  const task = await submitImageTask({
    modelId: "bytedance/seedream-v4.5",
    prompt: HOOK_PROMPT,
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
    "demo/romance-anime/clip001/hook-keyframe.png",
    buf,
    { contentType: "image/png", addRandomSuffix: false },
  );
  console.log(`  ✓ ${uploaded.url}`);
  return uploaded.url;
}

// ─── Step 2: Vidu shot ─────────────────────────────────────────────────────

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
      prompt: HOOK_MOTION,
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

// ─── Step 3: Kokoro TTS ────────────────────────────────────────────────────

const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";

async function generateNarration(outPath: string): Promise<void> {
  console.log("→ TTS (kokoro am_michael, elder male voice)");
  let submitRes: Response;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: KOKORO_VERSION,
        input: { text: NARRATION, voice: "am_michael", speed: 0.85 },
      }),
    });
    if (submitRes.ok) break;
    if (submitRes.status === 429) {
      const body = await submitRes.text();
      const m = body.match(/resets in ~(\d+)s/);
      const wait = m ? parseInt(m[1]!) + 2 : 15;
      console.log(`  ! 429, waiting ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`kokoro submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("kokoro retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;

  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status !== lastStatus) {
      console.log(`  [tts] ${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`kokoro ${data.status}: ${data.error}`);
    }
  }
  throw new Error("kokoro timed out");
}

// ─── Step 4: musicgen melancholic intro ────────────────────────────────────

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const HOOK_MUSIC_PROMPT =
  "Quiet melancholic solo felt piano intro, 50 BPM, very slow nostalgic " +
  "memory theme in F major, sparse single notes echoing in a warm room, " +
  "soft felted hammer tone with long reverb tail, gentle major-seventh " +
  "chords building from silence, aching tender bittersweet feeling that " +
  "begins distant and lonely then opens into hope, Joe Hisaishi 'One " +
  "Summer's Day' and Yiruma 'Kiss the Rain' influence, no drums, no " +
  "strings, no vocals, designed as the opening of a Makoto Shinkai anime " +
  "flashback memory scene";

async function generateBgm(durationSec: number, outPath: string): Promise<void> {
  console.log(`→ musicgen ${durationSec}s (melancholic intro)`);
  let submitRes: Response;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MUSICGEN_VERSION,
        input: {
          prompt: HOOK_MUSIC_PROMPT,
          duration: durationSec,
          model_version: "stereo-melody-large",
          output_format: "mp3",
          normalization_strategy: "peak",
        },
      }),
    });
    if (submitRes.ok) break;
    if (submitRes.status === 429) {
      const body = await submitRes.text();
      const m = body.match(/resets in ~(\d+)s/);
      const wait = m ? parseInt(m[1]!) + 2 : 15;
      console.log(`  ! 429, waiting ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`musicgen submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("musicgen retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;

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
      console.log(`  [music] ${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`musicgen ${data.status}: ${data.error}`);
    }
  }
  throw new Error("musicgen timed out");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Clip 001 Hook + Final Assembly ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-clip001-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Keyframe
  const keyframeUrl = await generateKeyframe();

  // 2. Submit Vidu shot
  console.log("\n→ Vidu submit");
  const taskId = await viduSubmit(keyframeUrl);
  console.log(`  ✓ ${taskId}`);

  // 3. In parallel: Vidu poll + BGM + TTS
  const bgmPath = join(tmp, "hook-bgm.mp3");
  const narrationPath = join(tmp, "hook-narration.mp3");

  console.log("\n→ parallel: Vidu poll + BGM + TTS");
  const [shotResult] = await Promise.all([
    viduPoll(taskId),
    generateBgm(11, bgmPath),
    generateNarration(narrationPath),
  ]);

  console.log(`  ✓ shot: ${shotResult.credits} cr`);

  // 4. Download shot
  const dlRes = await fetch(shotResult.url);
  const shotBuf = Buffer.from(await dlRes.arrayBuffer());
  const shotLocal = join(tmp, "hook-shot.mp4");
  writeFileSync(shotLocal, shotBuf);
  console.log(`  ✓ shot ${(shotBuf.length / 1024 / 1024).toFixed(2)} MB`);
  await put(
    "demo/romance-anime/clip001/hook-shot.mp4",
    shotBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  // 5. ffmpeg: build clip 001 standalone (10s: 2s open + 8s shot)
  // and full assembly (clip 001 → 1s white flash → clip 002 → 2s end card)
  console.log("\n→ ffmpeg compose clip 001 + final assembly");

  const clip001Local =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-clip001.mp4";
  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-full.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Build clip 001 (10s)
  // 2s opening title card + 8s hook shot with narration + BGM
  const openingFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='SIXTY YEARS AGO':fontcolor=white:fontsize=58:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vopen]`;

  const hookShotFilter =
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS,` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=7.0:d=1.0[vhook]`;

  const concat001 = `[vopen][vhook]concat=n=2:v=1:a=0[v001]`;

  // Audio for clip 001:
  //   bgm (input 1) at 0.30 over 10s, fades
  //   narration (input 2) starts at t=2.5s (0.5s into hook shot), volume 1.4
  const audio001 =
    `[1:a]volume=0.30,afade=t=in:st=0:d=1.5,afade=t=out:st=8.5:d=1.5,` +
    `apad=whole_dur=10[bgmA001];` +
    `[2:a]adelay=2500|2500,volume=1.5[narA001];` +
    `[bgmA001][narA001]amix=inputs=2:duration=longest:dropout_transition=0,` +
    `alimiter=limit=0.97[a001]`;

  const clip001Filter = [hookShotFilter, openingFilter, concat001, audio001].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", shotLocal,
      "-i", bgmPath,
      "-i", narrationPath,
      "-filter_complex", clip001Filter,
      "-map", "[v001]",
      "-map", "[a001]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-t", "10",
      "-y", clip001Local,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ clip 001: ${(readFileSync(clip001Local).length / 1024 / 1024).toFixed(2)} MB`);

  // Now full assembly: clip 001 (10s) + 1s white flash transition + clip 002 (20s) + 2s end card
  // Use concat with crossfade between clip 001 and clip 002 via xfade.
  // Simpler: just concat clip001 and clip002 with a brief audio crossfade.

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vendC]`;

  // Inputs: 0=clip001, 1=clip002, then end card synthesized.
  // Normalize both clips and concat with brief xfade between them.
  const fullFilter = [
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c001v]`,
    `[1:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c002v]`,
    // White flash crossfade: 0.8s xfade transition starting at clip001 end - 0.8 = 9.2
    `[c001v][c002v]xfade=transition=fadewhite:duration=0.8:offset=9.2[xfaded]`,
    endFilter,
    `[xfaded][vendC]concat=n=2:v=1:a=0[vfullout]`,
    // Audio: simple acrossfade between clip001 audio and clip002 audio
    `[0:a][1:a]acrossfade=d=0.8:c1=tri:c2=tri[afull];` +
    `[afull]apad=pad_dur=2,alimiter=limit=0.97[afullout]`,
  ].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", clip001Local,
      "-i", CLIP_002_PATH,
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

  // 6. Upload
  console.log("\n→ upload");
  const c001Up = await put(
    "demo/romance-anime/clip001/romance-anime-clip001.mp4",
    readFileSync(clip001Local),
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const fullUp = await put(
    "demo/romance-anime/full/romance-anime-full.mp4",
    readFileSync(finalLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${shotResult.credits} (~$${((shotResult.credits ?? 0) / 100).toFixed(2)})`);
  console.log(`\n📁 Clip 001 local: ${clip001Local}`);
  console.log(`📁 Full local:     ${finalLocal}`);
  console.log(`🎬 Clip 001 R2:    ${c001Up.url}`);
  console.log(`🎬 Full R2:        ${fullUp.url}`);
  console.log(`📷 Hook keyframe:  ${keyframeUrl}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
