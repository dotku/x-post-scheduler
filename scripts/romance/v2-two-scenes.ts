/**
 * Romance Anime Short — v2
 *
 * REVISED based on v1 feedback:
 *   - More romantic BGM (felted solo piano, slower tempo, more emotional)
 *   - Single coherent scene (~1.5 beats), not 4 disjoint scenes
 *   - English voice-over narration (OpenAI TTS, soft female voice)
 *   - Western/Caucasian girl + Asian boy (was: both Japanese)
 *   - Story: opening day of university, dance class, teacher pairs them up,
 *     they shyly bow to each other and begin to dance.
 *
 * Pipeline:
 *   1. Generate 2 anime keyframes:
 *      a) Wide dance studio with teacher gesturing students together
 *      b) The two students bowing to each other, about to dance
 *   2. Vidu Q3 Pro img2video — 2 shots × 8s each = 16s of motion
 *   3. OpenAI TTS — soft narration (nova voice) ~16s of speech
 *   4. Replicate musicgen — 24s tender felt-piano BGM
 *   5. ffmpeg compose: 2s opening title → shot 1 (8s) → shot 2 (8s) → 2s
 *      end card. Total ~20s. Narration overlay + BGM mixed underneath at
 *      lower volume so the voice carries.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import OpenAI from "openai";
import { put } from "../../lib/r2";
import { submitImageTask, getVideoTask } from "../../lib/wavespeed";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDU_KEY = process.env.VIDU_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!VIDU_KEY) throw new Error("VIDU_API_KEY not set");
if (!process.env.WAVESPEED_API_KEY) throw new Error("WAVESPEED_API_KEY not set");
if (!REPLICATE_KEY) throw new Error("REPLICATE_API_KEY not set");
if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not set");

const VIDU_BASE = "https://api.vidu.com/ent/v2";

// ─── Character anchors (verbatim across all prompts) ───────────────────────

const GIRL =
  "a Caucasian European university girl named Emma, age 19, with long " +
  "wavy strawberry-blonde hair down to her shoulders, soft grey-blue eyes, " +
  "fair skin with light freckles across her nose, gentle shy smile, " +
  "wearing a cream-colored knit cardigan over a white blouse, a slim " +
  "burgundy ribbon at the collar, navy pleated skirt, white knee-socks";

const BOY =
  "an Asian university boy named Kenji, age 19, with short tidy black hair, " +
  "thin silver wire-frame glasses, fair warm-toned skin, calm thoughtful " +
  "expression, slight blush on his cheeks, wearing a light blue collared " +
  "shirt under an unbuttoned dark navy blazer, dark trousers";

const STYLE =
  "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic " +
  "lighting, painterly volumetric god-rays, warm golden-hour glow, vibrant " +
  "saturated colors, lens flare, dreamy atmosphere, hyper-detailed " +
  "background art reminiscent of Your Name and Weathering With You, " +
  "Studio Ghibli influenced, vertical 9:16 cinematic composition";

// ─── Scenes (2 beats of one continuous moment) ─────────────────────────────

type Scene = {
  id: string;
  imagePrompt: string;
  motionPrompt: string;
};

const SCENES: Scene[] = [
  {
    id: "01-teacher-pairs",
    imagePrompt:
      `Wide cinematic interior of a beautiful university ballroom dance ` +
      `studio on the first day of the new semester. Tall arched windows on ` +
      `the left flood the polished hardwood floor with warm golden afternoon ` +
      `sunlight. An elegant middle-aged female dance instructor in a long ` +
      `flowing navy dress stands in the center of the room, smiling warmly ` +
      `and gesturing with one hand toward ${GIRL} on her right and ${BOY} on ` +
      `her left, gently introducing them to each other. Emma and Kenji both ` +
      `look at each other with shy nervous smiles and soft blushes. Other ` +
      `student pairs in soft focus practice in the background. Wall mirrors ` +
      `reflect the warm light. Dust motes drift through the sunbeams. ${STYLE}.`,
    motionPrompt:
      "Slow gentle camera dolly forward into the dance studio. The teacher " +
      "raises her hand in a soft welcoming gesture toward the two students. " +
      "Emma and Kenji slowly turn their heads to face each other, both with " +
      "shy smiles and soft pink blushes. Sunlight rays drift through the " +
      "tall windows. Dust particles float in the golden light. Background " +
      "dancers sway softly. Single continuous shot, no cuts, painterly " +
      "subtle motion.",
  },
  {
    id: "02-bow-and-dance",
    imagePrompt:
      `Medium two-shot of ${GIRL} and ${BOY} standing facing each other in ` +
      `the center of the sunlit ballroom dance studio, both bowing politely ` +
      `to one another at the start of their first practice dance. Emma's ` +
      `cardigan and skirt sway slightly as she lowers her head with a shy ` +
      `smile. Kenji bows formally with one hand resting over his heart, his ` +
      `cheeks flushed pink. The polished hardwood floor mirrors them softly. ` +
      `Behind them, the dance instructor watches with a warm approving smile. ` +
      `Tall arched windows pour golden afternoon sunlight across the scene, ` +
      `creating soft lens flare and floating dust particles in the air. ${STYLE}.`,
    motionPrompt:
      "The two students slowly bow to each other in unison, then gently rise " +
      "back up. Emma extends her right hand shyly toward Kenji. Kenji raises " +
      "his hand to meet hers. Their fingertips touch tentatively. Both " +
      "blush deeper. The camera slowly pushes in toward their joining hands, " +
      "then tilts up to catch their eyes meeting. Sunlight rays drift gently. " +
      "Dust particles sparkle. Single continuous romantic shot, no cuts, slow " +
      "deliberate motion.",
  },
];

// ─── Narration script ───────────────────────────────────────────────────────
//
// ~16-18 seconds of soft female narration timed to land across both shots.
// Pacing: ~150 words per minute → ~40 words for ~16 seconds.

const NARRATION =
  "The first day of a new semester. Emma never expected that a simple " +
  "dance class would change her whole world. But the moment their eyes " +
  "met... time itself seemed to pause.";

// ─── Step 1: Keyframe generation ────────────────────────────────────────────

async function generateKeyframe(scene: Scene): Promise<string> {
  console.log(`→ [${scene.id}] keyframe`);
  const task = await submitImageTask({
    modelId: "bytedance/seedream-v4.5",
    prompt: scene.imagePrompt,
    mode: "t2i",
    aspectRatio: "9:16",
  });
  const pollUrl = task.urls?.get || task.id;

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
      if (polled.status === "failed") throw new Error("Image gen failed");
    } catch (e) {
      console.log(`  ! poll: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!imageUrl) throw new Error(`Image timed out for ${scene.id}`);

  const dlRes = await fetch(imageUrl);
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
  const buf = Buffer.from(await dlRes.arrayBuffer());
  const uploaded = await put(
    `demo/romance-anime/v2/${scene.id}-keyframe.png`,
    buf,
    { contentType: "image/png", addRandomSuffix: false },
  );
  console.log(`  ✓ ${scene.id} keyframe: ${uploaded.url}`);
  return uploaded.url;
}

// ─── Step 2: Vidu shots ─────────────────────────────────────────────────────

async function viduSubmit(scene: Scene, referenceUrl: string): Promise<string> {
  const res = await fetch(`${VIDU_BASE}/img2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${VIDU_KEY}`,
    },
    body: JSON.stringify({
      model: "viduq3-pro",
      images: [referenceUrl],
      prompt: scene.motionPrompt,
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
      console.log(`  [${label}|${elapsed}s] ${data.state}`);
      lastState = data.state;
    }
    if (data.state === "success" && data.creations?.[0]) {
      return { url: data.creations[0].url, credits: data.credits };
    }
    if (data.state === "failed") {
      throw new Error(`Vidu ${label} failed: ${data.err_code || "unknown"}`);
    }
  }
  throw new Error(`Vidu ${label} timed out`);
}

// ─── Step 3: OpenAI TTS narration ───────────────────────────────────────────

async function generateNarration(outPath: string): Promise<void> {
  console.log("→ TTS narration (OpenAI tts-1, voice=nova)");
  const openai = new OpenAI({ apiKey: OPENAI_KEY });
  const response = await openai.audio.speech.create({
    model: "tts-1-hd",
    voice: "nova",
    input: NARRATION,
    speed: 0.92,
  });
  const buf = Buffer.from(await response.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`  ✓ ${(buf.length / 1024).toFixed(0)} KB`);
}

// ─── Step 4: Replicate musicgen ─────────────────────────────────────────────

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MUSIC_PROMPT =
  "Deeply romantic intimate solo felt piano love theme, 55 BPM, very slow " +
  "tender emotional melody in F major with rich major-seventh chords, soft " +
  "felted hammer tone with warm room reverb, gentle rolling left-hand " +
  "arpeggios beneath a delicate aching melody line, building to a soft " +
  "hopeful peak then breathing back down, Joe Hisaishi 'One Summer's Day' " +
  "and Yiruma 'River Flows in You' influence, sparse minimal arrangement, " +
  "no drums, no strings, no vocals, designed as the love theme for a " +
  "Makoto Shinkai anime romance scene, cinematic and aspirational";

async function generateBgm(durationSec: number, outPath: string): Promise<void> {
  console.log(`→ musicgen ${durationSec}s (felted love theme)`);
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
  if (!submitRes.ok) throw new Error(`musicgen submit: ${await submitRes.text()}`);
  const submitData = (await submitRes.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) throw new Error("musicgen no poll URL");

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
      console.log(`  [music|${elapsed}s] ${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      if (!audioRes.ok) throw new Error("audio download failed");
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
  console.log("=== Romance Anime Short v2 ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-anime-v2-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Generate both keyframes in parallel
  console.log("→ Step 1: 2 keyframes in parallel");
  const keyframes = await Promise.all(SCENES.map((s) => generateKeyframe(s)));

  // 2. Submit both Vidu shots in parallel
  console.log("\n→ Step 2: 2 Vidu shots in parallel");
  const taskIds = await Promise.all(
    SCENES.map((s, i) => viduSubmit(s, keyframes[i]!)),
  );
  taskIds.forEach((id, i) => console.log(`  ✓ ${SCENES[i]!.id}: ${id}`));

  // 3. In parallel: poll Vidu, generate BGM (24s), generate narration TTS
  // Total video: 2s opening + 8s shot1 + 8s shot2 + 2s end = 20s
  // BGM duration: 22s (covers crossfades on the ends)
  const bgmPath = join(tmp, "bgm.mp3");
  const narrationPath = join(tmp, "narration.mp3");

  const [shotResults] = await Promise.all([
    Promise.all(taskIds.map((id, i) => viduPoll(id, SCENES[i]!.id))),
    generateBgm(22, bgmPath),
    generateNarration(narrationPath),
  ]);

  let totalCredits = 0;
  shotResults.forEach((r, i) => {
    console.log(`  ✓ ${SCENES[i]!.id} → ${r.url} (${r.credits} cr)`);
    totalCredits += r.credits ?? 0;
  });

  // 4. Download both shots
  console.log("\n→ Step 3: download shots");
  const localShots: string[] = [];
  for (let i = 0; i < shotResults.length; i++) {
    const dl = await fetch(shotResults[i]!.url);
    if (!dl.ok) throw new Error(`download ${i} failed`);
    const buf = Buffer.from(await dl.arrayBuffer());
    const path = join(tmp, `shot-${i}.mp4`);
    writeFileSync(path, buf);
    localShots.push(path);
    console.log(`  ✓ shot ${i}: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

    await put(
      `demo/romance-anime/v2/${SCENES[i]!.id}-shot.mp4`,
      buf,
      { contentType: "video/mp4", addRandomSuffix: false },
    );
  }

  // 5. ffmpeg compose
  console.log("\n→ Step 4: ffmpeg compose (20s with narration + BGM)");

  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Two normalized shots
  const shotFilters = SCENES.map((_, i) =>
    `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS,` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=7.4:d=0.6[v${i}]`
  );

  // Opening title card (2s)
  const openingFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='FIRST LIGHT':fontcolor=white:fontsize=72:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-30:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))',` +
    `drawtext=fontfile=${FONT}:text='a short anime film':fontcolor=0xc8c8c8:fontsize=30:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:` +
    `alpha='if(lt(t,0.9),max(0,(t-0.3)/0.6),if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vopen]`;

  // End card (2s)
  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vend]`;

  // Concat: opening + shot0 + shot1 + end
  const concatFilter = `[vopen][v0][v1][vend]concat=n=4:v=1:a=0[vout]`;

  // Audio mix:
  //   [2:a] = bgm (input idx 2, since 0 and 1 are video shots)
  //   [3:a] = narration
  // Total video timeline: 2s open + 8s + 8s + 2s = 20s.
  // BGM: 22s, covers 0–20s with fade in/out
  // Narration: starts at t=2s (when shot 1 begins), ducks BGM via sidechain
  //
  // Strategy: BGM at 0.30 baseline, narration at 1.0; mix together.
  // Use adelay to push narration to 2.0s start.
  const audioFilter =
    `[2:a]volume=0.35,afade=t=in:st=0:d=1.5,afade=t=out:st=18:d=2.0,` +
    `apad=whole_dur=20[bgmA];` +
    `[3:a]adelay=2000|2000,volume=1.4[narA];` +
    `[bgmA][narA]amix=inputs=2:duration=longest:dropout_transition=0,` +
    `alimiter=limit=0.97[aout]`;

  const filterComplex = [
    ...shotFilters,
    openingFilter,
    endFilter,
    concatFilter,
    audioFilter,
  ].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", localShots[0]!,
      "-i", localShots[1]!,
      "-i", bgmPath,
      "-i", narrationPath,
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

  // 6. Upload
  console.log("\n→ Step 5: upload");
  const finalUploaded = await put(
    "demo/romance-anime/v2/romance-anime-v2.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  await put("demo/romance-anime/v2/bgm.mp3", readFileSync(bgmPath), {
    contentType: "audio/mpeg",
    addRandomSuffix: false,
  });
  await put("demo/romance-anime/v2/narration.mp3", readFileSync(narrationPath), {
    contentType: "audio/mpeg",
    addRandomSuffix: false,
  });

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${totalCredits} (~$${(totalCredits / 100).toFixed(2)})`);
  console.log(`\n📁 Local:    ${finalLocal}`);
  console.log(`🎬 Final R2: ${finalUploaded.url}`);
  keyframes.forEach((url, i) =>
    console.log(`📷 ${SCENES[i]!.id}: ${url}`),
  );
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
