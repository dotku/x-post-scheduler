/**
 * Resume romance-anime-v2 using already-submitted Vidu task IDs.
 * Skips keyframe generation and Vidu submission to avoid double-charging.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../../lib/r2";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const VIDU_KEY = process.env.VIDU_API_KEY!;
const REPLICATE_KEY = process.env.REPLICATE_API_KEY!;

const VIDU_BASE = "https://api.vidu.com/ent/v2";

const SCENES = [
  { id: "01-teacher-pairs", taskId: "939513516363091968" },
  { id: "02-bow-and-dance", taskId: "939513516363096064" },
];

const NARRATION =
  "The first day of a new semester. Emma never expected that a simple " +
  "dance class would change her whole world. But the moment their eyes " +
  "met... time itself seemed to pause.";

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

const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";

async function generateNarration(outPath: string): Promise<void> {
  console.log("→ TTS narration (Replicate kokoro-82m, voice=af_bella)");
  // Replicate throttles low-balance accounts; retry on 429
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
        input: { text: NARRATION, voice: "af_bella", speed: 0.9 },
      }),
    });
    if (submitRes.ok) break;
    if (submitRes.status === 429) {
      const body = await submitRes.text();
      const match = body.match(/resets in ~(\d+)s/);
      const wait = match ? parseInt(match[1]!) + 2 : 15;
      console.log(`  ! kokoro 429, waiting ${wait}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`kokoro submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("kokoro submit: too many retries");
  const submitData = (await submitRes.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) throw new Error("kokoro no poll URL");

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
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [tts|${elapsed}s] ${data.status}`);
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
      throw new Error(`kokoro ${data.status}: ${data.error || ""}`);
    }
  }
  throw new Error("kokoro timed out");
}

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

async function main() {
  console.log("=== Romance Anime v2 RESUME ===\n");
  const overallStart = Date.now();
  const tmp = mkdtempSync(join(tmpdir(), "romance-anime-v2r-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // Run BGM, narration, and Vidu polling in parallel
  const bgmPath = join(tmp, "bgm.mp3");
  const narrationPath = join(tmp, "narration.mp3");

  const [shotResults] = await Promise.all([
    Promise.all(SCENES.map((s) => viduPoll(s.taskId, s.id))),
    generateBgm(22, bgmPath),
    generateNarration(narrationPath),
  ]);

  let totalCredits = 0;
  shotResults.forEach((r, i) => {
    console.log(`  ✓ ${SCENES[i]!.id} → ${r.url} (${r.credits} cr)`);
    totalCredits += r.credits ?? 0;
  });

  // Download both shots
  console.log("\n→ download shots");
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

  // ffmpeg compose
  console.log("\n→ ffmpeg compose");

  const finalLocal =
    "/Users/wlin/dev/x-post-scheduler/public/videos/romance-anime-v2.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  const shotFilters = SCENES.map((_, i) =>
    `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=8,setpts=PTS-STARTPTS,` +
    `fade=t=in:st=0:d=0.6,fade=t=out:st=7.4:d=0.6[v${i}]`
  );

  const openingFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='FIRST LIGHT':fontcolor=white:fontsize=72:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-30:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))',` +
    `drawtext=fontfile=${FONT}:text='a short anime film':fontcolor=0xc8c8c8:fontsize=30:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:` +
    `alpha='if(lt(t,0.9),max(0,(t-0.3)/0.6),if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vopen]`;

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='to be continued\u2026':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'` +
    `[vend]`;

  const concatFilter = `[vopen][v0][v1][vend]concat=n=4:v=1:a=0[vout]`;

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

  console.log("\n→ upload");
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
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
