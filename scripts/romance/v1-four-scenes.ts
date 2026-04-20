/**
 * Romance Anime Short — v1
 *
 * A sub-1-minute Makoto Shinkai-style anime short about two university
 * students who meet in a ballroom dance class, discover they share more
 * classes, fall in love at first sight, and agree to study together at
 * the library.
 *
 * Pipeline:
 *   1. Generate 4 anime-style key frames (Wavespeed Seedream/Dreamina, 9:16)
 *      with strict character description anchors so the same two characters
 *      appear across all scenes.
 *   2. Vidu Q3 Pro img2video — 4 shots × 8s each, gentle camera motion.
 *   3. Replicate musicgen — solo piano romantic BGM.
 *   4. ffmpeg compose: opening title → 4 shots with fade transitions and
 *      English subtitles → end card → BGM mixed underneath.
 *   5. Upload final to R2.
 *
 * Total runtime: 4 shots × 8s + 4s opening + 4s end = 40s.
 * Estimated cost: ~$5-7. Estimated wall time: ~12-18 min (parallelized).
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../../lib/r2";
import { submitImageTask, getVideoTask } from "../../lib/wavespeed";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDU_KEY = process.env.VIDU_API_KEY;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
if (!VIDU_KEY) throw new Error("VIDU_API_KEY not set");
if (!process.env.WAVESPEED_API_KEY) throw new Error("WAVESPEED_API_KEY not set");
if (!REPLICATE_KEY) throw new Error("REPLICATE_API_KEY not set");

const VIDU_BASE = "https://api.vidu.com/ent/v2";

// ─── Character Anchors (CRITICAL: reused verbatim in every prompt) ──────────
//
// Anime character consistency is brittle. The single most effective trick is
// to repeat the EXACT same descriptive phrase for each character in every
// frame's prompt. Don't paraphrase.

const GIRL =
  "a Japanese university girl named Mei, age 19, with long straight black " +
  "hair down to her mid-back, soft warm brown eyes, fair skin, gentle " +
  "smile, wearing a cream-colored knit cardigan over a white blouse with " +
  "a small ribbon, navy pleated skirt, white knee-socks";

const BOY =
  "a Japanese university boy named Ren, age 19, with short messy black hair, " +
  "thin silver wire-frame glasses, fair skin, calm thoughtful expression, " +
  "wearing a light blue collared shirt under an unbuttoned dark navy blazer, " +
  "dark trousers";

const STYLE =
  "Makoto Shinkai anime film style, 2D cel-shaded animation, soft cinematic " +
  "lighting, painterly volumetric god-rays, warm golden-hour glow, vibrant " +
  "saturated colors, lens flare, dreamy atmosphere, hyper-detailed " +
  "background art reminiscent of Your Name and Weathering With You, " +
  "Studio Ghibli influenced, vertical 9:16 cinematic composition";

// ─── Scene Definitions ──────────────────────────────────────────────────────

type Scene = {
  id: string;
  imagePrompt: string;
  motionPrompt: string;
  subtitle: string;
};

const SCENES: Scene[] = [
  {
    id: "01-dance-class",
    imagePrompt:
      `${GIRL} and ${BOY} stand facing each other in a sunlit university ` +
      `ballroom dance studio, holding hands gently in a closed waltz position, ` +
      `awkward shy smiles on both their faces, slight blush. Tall arched ` +
      `windows behind them spill afternoon golden sunlight across the polished ` +
      `wooden floor. Other student dance pairs in soft focus in the background. ` +
      `Hardwood walls, wall mirrors. ${STYLE}.`,
    motionPrompt:
      "Gentle slow camera dolly forward toward the two students. They take a " +
      "small first dance step together. Soft wind moves the girl's hair " +
      "slightly. Sunlight rays drift through the windows. Other dancers in " +
      "the background sway softly. Subtle painterly motion, no cuts.",
    subtitle: "Autumn semester.   The first dance.",
  },
  {
    id: "02-recognize-classroom",
    imagePrompt:
      `A bright university lecture hall with rows of wooden desks. ${BOY} ` +
      `stands frozen in the doorway holding a stack of textbooks, eyes wide ` +
      `with surprise. ${GIRL} sits at a desk in the second row, looking up ` +
      `from her notebook with a startled-then-delighted smile, recognizing him. ` +
      `Tall windows on the right side flood the room with morning light. ` +
      `Other students in soft focus. ${STYLE}.`,
    motionPrompt:
      "Slow push-in toward the boy in the doorway, then a gentle pan to the " +
      "girl who slowly looks up from her notebook. Her eyes widen with " +
      "recognition. Soft sunlight drifts. Subtle dust particles in the air. " +
      "No cuts, single continuous shot.",
    subtitle: "Then\u2014in another classroom.",
  },
  {
    id: "03-eyes-meet",
    imagePrompt:
      `Intimate close-up of ${GIRL} and ${BOY} sitting near each other in ` +
      `the lecture hall, their eyes meeting across a small distance. Both have ` +
      `soft pink blushes on their cheeks, lips slightly parted in a tender ` +
      `realization. The background is dreamy soft-focus with bokeh light ` +
      `particles and floating cherry blossom petals drifting through the air. ` +
      `Warm golden afternoon light bathes them. Time feels suspended. ${STYLE}.`,
    motionPrompt:
      "Extreme slow zoom in on the space between their eyes. Cherry blossom " +
      "petals drift gently from upper-right to lower-left. Bokeh light " +
      "particles sparkle. Both characters' eyes shimmer subtly. The girl's " +
      "hair sways slightly in a breath of wind. Romantic and suspended.",
    subtitle: "Our eyes met.   And the world\u2026 stopped.",
  },
  {
    id: "04-library-together",
    imagePrompt:
      `Wide warm interior of a beautiful old university library. ${GIRL} and ` +
      `${BOY} sit side by side at a long wooden study table by a tall arched ` +
      `window. Open textbooks, notebooks, and two cups of tea between them. ` +
      `Mei looks down at her book with a small private smile. Ren glances ` +
      `sideways at her with quiet affection. Late afternoon sunset light pours ` +
      `through the window, painting everything in honey-gold. Tall bookshelves ` +
      `stretch into the soft-focus background. ${STYLE}.`,
    motionPrompt:
      "Slow gentle pull-back from a medium two-shot of the two students at " +
      "the library table, gradually revealing more of the warm library and " +
      "bookshelves. Sunset light shifts subtly. The boy turns his head a " +
      "little to look at the girl. She turns a page. Dust motes drift in the " +
      "golden light. Single continuous shot.",
    subtitle: "Tomorrow.   The library.   Together.",
  },
];

// ─── Step 1: Generate key frames ────────────────────────────────────────────

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
    `demo/romance-anime/v1/${scene.id}-keyframe.png`,
    buf,
    { contentType: "image/png", addRandomSuffix: false },
  );
  console.log(`  ✓ ${scene.id} keyframe: ${uploaded.url}`);
  return uploaded.url;
}

// ─── Step 2: Vidu img2video shots ───────────────────────────────────────────

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
      console.log(`  [${label}|${elapsed}s] state=${data.state}`);
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

// ─── Step 3: Replicate musicgen ─────────────────────────────────────────────

const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

const MUSIC_PROMPT =
  "Tender solo piano romantic film score, 65 BPM, intimate emotional " +
  "melody in C major, gentle arpeggios building to a soft hopeful peak, " +
  "Joe Hisaishi and Yiruma influenced, sparse minimal arrangement, deep " +
  "warm felt-piano tone, no drums, no vocals, designed for a Makoto Shinkai " +
  "anime romance scene, intimate and aspirational mood";

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
  console.log("=== Romance Anime Short v1 ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-anime-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Generate all 4 keyframes in parallel
  console.log("→ Step 1: 4 keyframes in parallel");
  const keyframes = await Promise.all(SCENES.map((s) => generateKeyframe(s)));

  // 2. Submit all 4 Vidu shots in parallel
  console.log("\n→ Step 2: submit 4 Vidu img2video shots in parallel");
  const taskIds = await Promise.all(
    SCENES.map((s, i) => viduSubmit(s, keyframes[i]!)),
  );
  taskIds.forEach((id, i) => console.log(`  ✓ ${SCENES[i]!.id}: ${id}`));

  // 3. Poll Vidu in parallel + run musicgen in parallel.
  // BGM: ~48s = 4×8 (shots) + 4 (open) + 4 (end) + 4 (transitions cushion)
  const bgmPath = join(tmp, "bgm.mp3");
  const [shotResults] = await Promise.all([
    Promise.all(taskIds.map((id, i) => viduPoll(id, SCENES[i]!.id))),
    generateBgm(50, bgmPath),
  ]);

  let totalCredits = 0;
  shotResults.forEach((r, i) => {
    console.log(`  ✓ ${SCENES[i]!.id} → ${r.url} (${r.credits} credits)`);
    totalCredits += r.credits ?? 0;
  });

  // 4. Download all 4 shots
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

    // Archive raw shot
    await put(
      `demo/romance-anime/v1/${SCENES[i]!.id}-shot.mp4`,
      buf,
      { contentType: "video/mp4", addRandomSuffix: false },
    );
  }

  // 5. Compose final with ffmpeg
  console.log("\n→ Step 4: ffmpeg compose");

  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v1.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Escape colons inside drawtext text
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");

  // Each shot: scale to 720x1280, fps 30, draw subtitle in lower third with
  // semi-transparent box, fade in/out at clip edges.
  const shotFilters = SCENES.map((scene, i) => {
    const sub = esc(scene.subtitle);
    return (
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
      `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
      `trim=duration=8,setpts=PTS-STARTPTS,` +
      `drawtext=fontfile=${FONT}:text='${sub}':fontcolor=white:fontsize=42:` +
      `x=(w-text_w)/2:y=h-260:` +
      `box=1:boxcolor=black@0.55:boxborderw=24:` +
      `alpha='if(lt(t,0.6),t/0.6,if(gt(t,7.2),max(0,1-(t-7.2)/0.6),1))',` +
      `fade=t=in:st=0:d=0.5,fade=t=out:st=7.5:d=0.5[v${i}]`
    );
  });

  // Opening title card (4s)
  const openingFilter =
    `color=c=black:s=720x1280:d=4:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='FIRST LIGHT':fontcolor=white:fontsize=72:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-30:` +
    `alpha='if(lt(t,0.8),t/0.8,if(gt(t,3.2),max(0,1-(t-3.2)/0.8),1))',` +
    `drawtext=fontfile=${FONT}:text='a short anime film':fontcolor=0xc8c8c8:fontsize=30:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:` +
    `alpha='if(lt(t,1.2),max(0,(t-0.4)/0.8),if(gt(t,3.2),max(0,1-(t-3.2)/0.8),1))'` +
    `[vopen]`;

  // End card (4s)
  const endFilter =
    `color=c=black:s=720x1280:d=4:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.8),t/0.8,if(gt(t,3.2),max(0,1-(t-3.2)/0.8),1))'` +
    `[vend]`;

  // Concat all 6 segments: opening + 4 shots + end
  const concatInputs = ["[vopen]", "[v0]", "[v1]", "[v2]", "[v3]", "[vend]"].join("");
  const concatFilter = `${concatInputs}concat=n=6:v=1:a=0[vout]`;

  // Audio: bgm with fade in/out, total ~48s
  // Total video: 4 + 8*4 + 4 = 40s
  const audioFilter =
    `[4:a]volume=0.85,afade=t=in:st=0:d=2.0,afade=t=out:st=38:d=2.0,alimiter=limit=0.95[aout]`;

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
      "-i", localShots[2]!,
      "-i", localShots[3]!,
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

  // 6. Upload
  console.log("\n→ Step 5: upload final to R2");
  const finalUploaded = await put(
    "demo/romance-anime/v1/romance-anime-v1.mp4",
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const bgmBuf = readFileSync(bgmPath);
  const bgmUploaded = await put(
    "demo/romance-anime/v1/bgm.mp3",
    bgmBuf,
    { contentType: "audio/mpeg", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Vidu credits: ${totalCredits} (~$${(totalCredits / 100).toFixed(2)})`);
  console.log(`\n📁 Local:    ${finalLocal}`);
  console.log(`🎬 Final R2: ${finalUploaded.url}`);
  console.log(`🎵 BGM R2:   ${bgmUploaded.url}`);
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
