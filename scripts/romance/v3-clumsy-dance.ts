/**
 * Romance Anime — Clip 003: Clumsy Dance (Seedance 2.0)
 *
 * Continues the story after clip 002 (the bow). The young couple takes
 * their first awkward steps together — Kenji accidentally steps on Emma's
 * foot, both blush and laugh nervously, then slowly find their rhythm and
 * begin to truly dance together with growing confidence and tenderness.
 *
 * Switches video provider: Seedance 2.0 (~$0.60/8s) instead of Vidu Q3 Pro
 * (~$2.00/8s) — saves 70%.
 *
 * Final assembly v4:
 *   clip001-v2 (10s) → fadewhite → transition (8s w/BGM) → fade →
 *   clip002 (20s) → fade → 2 new dance shots (16s) → end card (2s)
 *   ≈ 56s total
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../../lib/r2";
import { submitSeedanceVideoTask, getSeedanceVideoTask } from "../../lib/seedance";
import { writeFileSync, readFileSync, mkdtempSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const REPLICATE_KEY = process.env.REPLICATE_API_KEY!;
if (!REPLICATE_KEY) throw new Error("REPLICATE_API_KEY not set");
if (!process.env.SEEDANCE_API_KEY) throw new Error("SEEDANCE_API_KEY not set");

// Reuse the v2 "bow and dance" keyframe — preserves character consistency
// (same Emma + Kenji faces, same dance studio, same outfits) and avoids any
// Wavespeed image generation cost.
const REUSED_KEYFRAME =
  "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/romance-anime/v2/02-bow-and-dance-keyframe.png";

const CLIP_001 =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-clip001-v2.mp4";
const CLIP_002 =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
const TRANSITION =
  "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-transition.mp4";
for (const p of [CLIP_001, CLIP_002, TRANSITION]) {
  if (!existsSync(p)) throw new Error(`Missing: ${p}`);
}

// ─── Character anchors (must match v2 verbatim) ─────────────────────────────

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

// ─── New scenes ─────────────────────────────────────────────────────────────

type Scene = {
  id: string;
  motionPrompt: string;
};

// Both shots start from the same v2 bow keyframe and animate forward into
// different beats — Seedance 2.0 i2v interpolates from that starting pose.
const SCENES: Scene[] = [
  {
    id: "03-clumsy-step",
    motionPrompt:
      `From this bowing pose, ${GIRL} (Emma) and ${BOY} (Kenji) rise back ` +
      `up and clasp hands awkwardly in a closed waltz position. Kenji takes ` +
      `a tentative first step forward and accidentally steps on Emma's foot. ` +
      `Emma's eyes widen in surprise with a small "oh!" then immediately ` +
      `breaks into a soft laughing smile, cheeks flushing bright pink. ` +
      `Kenji's face fills with apologetic mortification, blush deepening, ` +
      `eyes squeezed shut behind his glasses, mouth opening in a silent ` +
      `"sorry!". They steady each other gently. Sunlight rays drift through ` +
      `the tall windows of the dance studio, dust particles floating. ` +
      `Single continuous shot, no cuts, ${STYLE}.`,
  },
  {
    id: "04-finding-rhythm",
    motionPrompt:
      `From this starting position, ${GIRL} (Emma) and ${BOY} (Kenji) begin ` +
      `to dance a slow tentative waltz together in the sunlit ballroom ` +
      `studio, swaying with growing confidence. Emma's strawberry-blonde ` +
      `hair and pleated skirt flow gracefully with the gentle rotation. ` +
      `Kenji guides her with quiet tenderness, glasses catching the warm ` +
      `golden light, looking down at her with a soft loving smile. Both ` +
      `wear warm smiles with rosy blushes still on their cheeks. Their ` +
      `footwork remains slightly imperfect but full of youthful sweetness. ` +
      `The camera does a slow gentle orbit around them. Sunbeams pour from ` +
      `the tall arched windows, dust particles sparkling. Single continuous ` +
      `romantic shot, ${STYLE}.`,
  },
];

const NARRATION =
  "Their first steps were... not graceful. But laughter came easier than " +
  "either of them expected.";

// ─── Steps ──────────────────────────────────────────────────────────────────

async function seedanceShot(scene: Scene, referenceUrl: string, label: string): Promise<string> {
  console.log(`→ [${scene.id}] Seedance 2.0 i2v`);
  const submitted = await submitSeedanceVideoTask({
    modelId: "seedance-2.0/image-to-video",
    prompt: scene.motionPrompt,
    imageUrl: referenceUrl,
    aspectRatio: "9:16",
    duration: 8,
    lockCamera: false,
    generateAudio: false,
  });
  console.log(`  ✓ submitted: ${submitted.id}`);

  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 15 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const polled = await getSeedanceVideoTask(submitted.id);
    if (polled.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${label}|${elapsed}s] ${polled.status}`);
      lastStatus = polled.status;
    }
    if (polled.status === "completed" && polled.outputs?.[0]) {
      return polled.outputs[0];
    }
    if (polled.status === "failed") {
      throw new Error(`Seedance ${label} failed: ${polled.error}`);
    }
  }
  throw new Error(`Seedance ${label} timed out`);
}

const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";

async function generateNarration(outPath: string): Promise<void> {
  console.log("→ TTS narration (kokoro af_bella)");
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
        input: { text: NARRATION, voice: "af_bella", speed: 0.92 },
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

const DANCE_MUSIC_PROMPT =
  "Tender playful felted piano waltz, 75 BPM, gentle 3/4 time signature, " +
  "warm major key with light major-seventh chords, soft rolling left-hand " +
  "bass with delicate right-hand melody, charming youthful innocent " +
  "feeling with a hint of romantic blossoming, light and airy with " +
  "occasional sparkling high notes like sunlight shimmering, Joe Hisaishi " +
  "and Yann Tiersen 'Amelie' influence, no drums, no strings, no vocals, " +
  "designed as a Makoto Shinkai anime romance dance scene";

async function generateMusic(outPath: string, durationSec: number): Promise<void> {
  console.log(`→ musicgen ${durationSec}s (clumsy dance waltz)`);
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
          prompt: DANCE_MUSIC_PROMPT,
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

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Romance Anime v4 — Clumsy Dance (Seedance 2.0) ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-clumsy-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // 1. Skip keyframe gen — reuse the v2 "bow and dance" keyframe for both
  // shots (preserves Emma/Kenji character consistency, no Wavespeed cost).
  console.log(`→ Reusing v2 keyframe: ${REUSED_KEYFRAME}`);

  // 2. Submit 2 Seedance shots in parallel + run BGM and TTS in parallel
  console.log("\n→ Step 2: Seedance 2.0 shots + audio (parallel)");
  const bgmPath = join(tmp, "dance-bgm.mp3");
  const narrationPath = join(tmp, "dance-narration.mp3");

  const [shot1Url, shot2Url] = await Promise.all([
    seedanceShot(SCENES[0]!, REUSED_KEYFRAME, SCENES[0]!.id),
    seedanceShot(SCENES[1]!, REUSED_KEYFRAME, SCENES[1]!.id),
    generateMusic(bgmPath, 18),
    generateNarration(narrationPath),
  ]);
  const shotUrls = [shot1Url, shot2Url];

  // 3. Download both shots
  console.log("\n→ Step 3: download shots");
  const localShots: string[] = [];
  for (let i = 0; i < shotUrls.length; i++) {
    const dl = await fetch(shotUrls[i]!);
    if (!dl.ok) throw new Error(`download ${i} failed`);
    const buf = Buffer.from(await dl.arrayBuffer());
    const path = join(tmp, `shot-${i}.mp4`);
    writeFileSync(path, buf);
    localShots.push(path);
    console.log(`  ✓ shot ${i}: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

    await put(
      `demo/romance-anime/v3-clumsy/${SCENES[i]!.id}-shot.mp4`,
      buf,
      { contentType: "video/mp4", addRandomSuffix: false },
    );
  }

  // 4. Build the new clumsy dance segment (16s with narration + waltz BGM)
  console.log("\n→ Step 4: ffmpeg compose dance segment");

  const danceLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-clumsy-dance.mp4";
  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-full-v4.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  // Two normalized 8s shots with crossfade between them
  const shotFilters = SCENES.map((_, i) =>
    `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS[v${i}]`
  );

  // Crossfade between shot 0 and shot 1: 0.6s overlap at offset 7.4
  const xfadeShots = `[v0][v1]xfade=transition=fade:duration=0.6:offset=7.4[vDance]`;

  // Audio for dance segment (15.4s after xfade overlap):
  //   bgm (input 2) at 0.40 vol, 18s of music
  //   narration (input 3) starts at t=0.5s, vol 1.4
  const danceAudio =
    `[2:a]volume=0.40,afade=t=in:st=0:d=1.0,afade=t=out:st=14.0:d=1.4,` +
    `apad=whole_dur=15.4[bgmDA];` +
    `[3:a]adelay=500|500,volume=1.5[narDA];` +
    `[bgmDA][narDA]amix=inputs=2:duration=longest:dropout_transition=0,` +
    `alimiter=limit=0.97[aDance]`;

  const danceFilter = [...shotFilters, xfadeShots, danceAudio].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", localShots[0]!,
      "-i", localShots[1]!,
      "-i", bgmPath,
      "-i", narrationPath,
      "-filter_complex", danceFilter,
      "-map", "[vDance]",
      "-map", "[aDance]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", danceLocal,
    ],
    { stdio: "pipe" },
  );
  console.log(`  ✓ dance: ${(readFileSync(danceLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 5. Full assembly v4
  // Re-bake the existing transition with BGM (we did this in fix.ts but the
  // source transition.mp4 itself is silent; for v4 we use the audio-mixed
  // version stored under public, which is the v3 full embedded — extract
  // approach is messier than just re-using the silent transition and adding
  // BGM here. To keep it simple: rebuild from the same source as fix.ts.)
  //
  // Inputs:
  //   0 = clip001 v2 (10s, has narration + BGM)
  //   1 = transition (8s, SILENT — we'll mux a brief BGM bed)
  //   2 = clip002 (20s, has narration + BGM)
  //   3 = dance segment (15.4s, has narration + BGM)

  console.log("\n→ Step 5: full assembly v4");

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vendC]`;

  const norm0 = `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c001v]`;
  const norm1 = `[1:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[transV]`;
  const norm2 = `[2:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c002v]`;
  const norm3 = `[3:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[c003v]`;

  // xfade chain timing:
  //   clip001 (10s) ⟶ fadewhite 0.8s ⟶ transition (8s) at offset 9.2
  //     timeline: 17.2s
  //   ⟶ fade 0.8s ⟶ clip002 (20s) at offset 16.4
  //     timeline: 36.4s
  //   ⟶ fade 0.8s ⟶ dance (15.4s) at offset 35.6
  //     timeline: 51.0s
  //   ⟶ concat 2s end card ⟶ 53.0s
  const xfade1 = `[c001v][transV]xfade=transition=fadewhite:duration=0.8:offset=9.2[xa]`;
  const xfade2 = `[xa][c002v]xfade=transition=fade:duration=0.8:offset=16.4[xb]`;
  const xfade3 = `[xb][c003v]xfade=transition=fade:duration=0.8:offset=35.6[xc]`;
  const concatEnd = `[xc][vendC]concat=n=2:v=1:a=0[vfullout]`;

  // Audio chain — clip001, clip002, dance all have audio. Transition is silent.
  // To bridge transition smoothly: chain clip001 audio → silence (transition)
  // → clip002 audio → dance audio with acrossfade between non-silent pairs.
  //
  // Strategy:
  //   [0:a] (10s) followed by 7.2s silence (transition) → produces 17.2s "A"
  //   acrossfade A with [2:a] (20s)
  //   acrossfade result with [3:a] (15.4s)
  //   pad 2s for end card
  const audioFilter =
    `[0:a]afade=t=out:st=8.5:d=1.5,apad=pad_dur=8[a0p];` +
    `[a0p][2:a]acrossfade=d=0.8:c1=tri:c2=tri[a02];` +
    `[a02][3:a]acrossfade=d=0.8:c1=tri:c2=tri[a023];` +
    `[a023]apad=pad_dur=2,alimiter=limit=0.97[afullout]`;

  const fullFilter = [norm0, norm1, norm2, norm3, xfade1, xfade2, xfade3, endFilter, concatEnd, audioFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", CLIP_001,
      "-i", TRANSITION,
      "-i", CLIP_002,
      "-i", danceLocal,
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
  console.log(`  ✓ full v4: ${(readFileSync(finalLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 6. Upload
  console.log("\n→ Step 6: upload");
  const danceUp = await put(
    "demo/romance-anime/v3-clumsy/romance-anime-clumsy-dance.mp4",
    readFileSync(danceLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );
  const fullUp = await put(
    "demo/romance-anime/full/romance-anime-full-v4.mp4",
    readFileSync(finalLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  const totalSec = Math.round((Date.now() - overallStart) / 1000);
  console.log("\n========================================");
  console.log(`✓ Done in ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log("========================================");
  console.log(`Seedance 2.0 estimated cost: 2 × $0.60 = $1.20`);
  console.log(`\n📁 Dance segment: ${danceLocal}`);
  console.log(`📁 Full v4:       ${finalLocal}`);
  console.log(`🎬 Dance R2:      ${danceUp.url}`);
  console.log(`🎬 Full v4 R2:    ${fullUp.url}`);
  console.log(`📷 Reused keyframe: ${REUSED_KEYFRAME}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
