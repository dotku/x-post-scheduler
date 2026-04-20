/**
 * Romance Anime — fix two issues:
 *   1. Regenerate clip 001 hook with ELDERLY Emma in the photo album (not young)
 *   2. Generate ambient BGM for the campus transition (no longer silent)
 *   3. Reassemble full video v3 with transition BGM under it
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

const TRANSITION_LOCAL =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-transition.mp4";
const CLIP_002 =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
for (const p of [TRANSITION_LOCAL, CLIP_002]) {
  if (!existsSync(p)) throw new Error(`Missing: ${p}`);
}

// ─── New clip 001 hook prompt — elderly Emma in the photo ──────────────────

const HOOK_PROMPT =
  "An elderly Asian man in his 80s, with neatly combed silver-grey hair, " +
  "thin silver wire-frame glasses, deep gentle wrinkles around warm brown " +
  "eyes, fair warm-toned skin, wearing a soft beige cardigan over a white " +
  "collared shirt, sitting alone in a wooden chair by a tall arched window " +
  "in a quiet nursing home room. Late afternoon golden sunlight pours " +
  "through the window, painting the room in warm honey tones. On his lap " +
  "rests an open old leather photo album. Visible on the open page is a " +
  "framed color photograph of an elderly Caucasian European woman in her " +
  "late seventies — his late wife — with soft silver-white hair gently " +
  "pulled back, gentle warm grey-blue eyes, soft kind wrinkles around her " +
  "eyes and mouth, a tender loving smile, fair skin with gentle age " +
  "freckles, wearing a soft cream cardigan with a small ribbon brooch at " +
  "the collar. The photograph captures her looking lovingly at the camera, " +
  "warm and full of life. The old man's weathered fingers gently rest on " +
  "the photograph, tracing its edge. A single tear glistens at the corner " +
  "of his eye. Soft floating dust particles drift in the sunbeams. " +
  "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic " +
  "lighting, painterly volumetric god-rays, warm golden-hour glow, vibrant " +
  "saturated colors, lens flare, dreamy melancholic atmosphere, " +
  "hyper-detailed background art reminiscent of Your Name and Weathering " +
  "With You, Studio Ghibli influenced, vertical 9:16 cinematic composition.";

const HOOK_MOTION =
  "Slow gentle camera dolly forward toward the elderly man sitting by the " +
  "window. He slowly turns one page of the photo album with his weathered " +
  "fingers. His eyes settle on the photograph of his elderly late wife. " +
  "His gaze softens with a faint trembling smile. A single tear glistens " +
  "and slowly rolls down his cheek. Sunlight rays drift gently through " +
  "the window, dust particles floating in the warm golden light. Single " +
  "continuous shot, no cuts, slow deliberate emotional motion.";

const NARRATION =
  "Sixty years ago, on the first day of a new semester... I met the girl " +
  "who would change everything.";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function generateKeyframe(): Promise<string> {
  console.log("→ keyframe (old Kenji + photo of elderly Emma)");
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
    "demo/romance-anime/clip001-v2/hook-keyframe.png",
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

const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";

async function generateNarration(outPath: string): Promise<void> {
  console.log("→ TTS narration (kokoro am_michael, elder male)");
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
      console.log(`  ! 429 ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`kokoro submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("kokoro retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
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

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

async function generateMusic(prompt: string, durationSec: number, outPath: string, label: string): Promise<void> {
  console.log(`→ musicgen ${durationSec}s (${label})`);
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
          prompt,
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
      console.log(`  ! 429 ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`musicgen submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("musicgen retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
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

const HOOK_MUSIC_PROMPT =
  "Quiet melancholic solo felt piano intro, 50 BPM, very slow nostalgic " +
  "memory theme in F major, sparse single notes echoing in a warm room, " +
  "soft felted hammer tone with long reverb tail, gentle major-seventh " +
  "chords building from silence, aching tender bittersweet feeling that " +
  "begins distant and lonely then opens into hope, Joe Hisaishi 'One " +
  "Summer's Day' and Yiruma 'Kiss the Rain' influence, no drums, no " +
  "strings, no vocals";

const TRANSITION_MUSIC_PROMPT =
  "Hopeful warm anime piano interlude, 70 BPM, gentle flowing arpeggios in " +
  "F major, soft felted piano with light room reverb, lifting major chord " +
  "progression building gradually with quiet optimism, sparse delicate " +
  "bell-like high notes shimmering above, the feeling of stepping out into " +
  "a beautiful autumn morning full of possibility, Joe Hisaishi 'The Path " +
  "of the Wind' style, no drums, no strings, no vocals";

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Romance Anime FIX (clip001 v2 + transition BGM) ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-fix-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Generate new keyframe (elderly Emma in photo)
  const keyframeUrl = await generateKeyframe();

  // 2. Submit new Vidu hook shot
  console.log("\n→ Vidu submit");
  const taskId = await viduSubmit(keyframeUrl);
  console.log(`  ✓ ${taskId}`);

  // 3. Parallel: Vidu poll + hook BGM + transition BGM + narration
  const hookBgmPath = join(tmp, "hook-bgm.mp3");
  const transBgmPath = join(tmp, "trans-bgm.mp3");
  const narrationPath = join(tmp, "narration.mp3");

  console.log("\n→ parallel: Vidu poll + hook BGM + transition BGM + TTS");
  const [shotResult] = await Promise.all([
    viduPoll(taskId),
    generateMusic(HOOK_MUSIC_PROMPT, 11, hookBgmPath, "hook"),
    generateMusic(TRANSITION_MUSIC_PROMPT, 9, transBgmPath, "transition"),
    generateNarration(narrationPath),
  ]);
  console.log(`  ✓ Vidu credits: ${shotResult.credits}`);

  // 4. Download Vidu shot
  const dlRes = await fetch(shotResult.url);
  const shotBuf = Buffer.from(await dlRes.arrayBuffer());
  const shotLocal = join(tmp, "hook-shot.mp4");
  writeFileSync(shotLocal, shotBuf);
  console.log(`  ✓ shot ${(shotBuf.length / 1024 / 1024).toFixed(2)} MB`);
  await put(
    "demo/romance-anime/clip001-v2/hook-shot.mp4",
    shotBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  // 5. Build new clip001 v2 (10s: 2s opening + 8s hook with narration + BGM)
  console.log("\n→ ffmpeg compose clip001 v2");

  const clip001Local =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-clip001-v2.mp4";
  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-full-v3.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

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
      "-i", hookBgmPath,
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
  console.log(`  ✓ clip001 v2: ${(readFileSync(clip001Local).length / 1024 / 1024).toFixed(2)} MB`);

  // 6. Re-bake transition with BGM (the existing transition.mp4 is silent;
  // we mux the new BGM under it)
  console.log("\n→ ffmpeg compose transition with BGM");
  const transitionWithBgm = join(tmp, "transition-with-bgm.mp4");
  // Transition is 8s long. BGM is 9s. Fade in/out.
  const transAudio =
    `[1:a]volume=0.55,afade=t=in:st=0:d=1.0,afade=t=out:st=7.0:d=1.0,` +
    `atrim=duration=8,alimiter=limit=0.97[atOut]`;
  execFileSync(
    ffmpeg,
    [
      "-i", TRANSITION_LOCAL,
      "-i", transBgmPath,
      "-filter_complex", transAudio,
      "-map", "0:v",
      "-map", "[atOut]",
      "-c:v", "copy",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", transitionWithBgm,
    ],
    { stdio: "pipe" },
  );

  // 7. Full assembly v3:
  //   clip001 v2 (10s) + xfade fadewhite 0.8s + transition (8s w/BGM) +
  //   xfade fade 0.8s + clip002 (20s) + concat end card (2s)
  console.log("\n→ ffmpeg full assembly v3");

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vendC]`;

  const norm0 = `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c001v]`;
  const norm1 = `[1:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[transV]`;
  const norm2 = `[2:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c002v]`;

  const xfade1 = `[c001v][transV]xfade=transition=fadewhite:duration=0.8:offset=9.2[xa]`;
  const xfade2 = `[xa][c002v]xfade=transition=fade:duration=0.8:offset=16.4[xb]`;
  const concatEnd = `[xb][vendC]concat=n=2:v=1:a=0[vfullout]`;

  // Audio chain:
  //   [0:a] = clip001 audio (10s, BGM + narration)
  //   [1:a] = transition audio (8s, BGM)
  //   [2:a] = clip002 audio (20s, BGM + narration)
  // Use acrossfade between adjacent pairs to bridge them smoothly.
  const audioFilter =
    `[0:a][1:a]acrossfade=d=0.8:c1=tri:c2=tri[a01];` +
    `[a01][2:a]acrossfade=d=0.8:c1=tri:c2=tri[a012];` +
    `[a012]apad=pad_dur=2,alimiter=limit=0.97[afullout]`;

  const fullFilter = [norm0, norm1, norm2, xfade1, xfade2, endFilter, concatEnd, audioFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", clip001Local,
      "-i", transitionWithBgm,
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
  console.log(`  ✓ full v3: ${(readFileSync(finalLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 8. Upload
  console.log("\n→ upload");
  const c001Up = await put(
    "demo/romance-anime/clip001-v2/romance-anime-clip001-v2.mp4",
    readFileSync(clip001Local),
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const fullUp = await put(
    "demo/romance-anime/full/romance-anime-full-v3.mp4",
    readFileSync(finalLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${shotResult.credits} (~$${((shotResult.credits ?? 0) / 100).toFixed(2)})`);
  console.log(`\n📁 Clip001 v2 local: ${clip001Local}`);
  console.log(`📁 Full v3 local:    ${finalLocal}`);
  console.log(`🎬 Clip001 v2 R2:    ${c001Up.url}`);
  console.log(`🎬 Full v3 R2:       ${fullUp.url}`);
  console.log(`📷 Hook keyframe:    ${keyframeUrl}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
