/**
 * One-shot: resume the b0uypscwc test run using already-completed assets.
 * Skips: Director, keyframes, Seedance (all already done).
 * Runs: narration, BGM, ffmpeg compose, upload.
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { put } from "../../lib/r2";

const REPLICATE_KEY = process.env.REPLICATE_API_KEY!;
const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";
const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

// ─── Plan manually reconstructed from previous run ─────────────────────────
// (Director output from b0uypscwc — "GOLDEN HOUR GRACE")
const R2_PREFIX = "animation/test-1776210260492";
const SHOT_URLS = [
  "https://tempfile.aiquickdraw.com/r/ca46676944205eee757fb4d61b1e342a_1776210359_7akdtlj1.mp4",
  "https://tempfile.aiquickdraw.com/r/44e40d8a6e13790cfc51caa8eedc281f_1776210351_eij1qbr4.mp4",
];

// Representative plan matching the original director output (inferred from log)
const SCENES = [
  { id: "01-library-sunset-study", duration: 8, narration: "The library was silent, except for the whisper of pages and her own quiet thoughts." },
  { id: "02-crush-sits-down", duration: 8, narration: "Until he sat down across from her — and her heart forgot how to read." },
];
const OPENING_TITLE = "GOLDEN HOUR GRACE";
const END_CARD = "to be continued…";
const MUSIC_PROMPT =
  "Tender intimate solo felt piano, 62 BPM, warm major key with major-seventh chords, " +
  "sparse delicate melody, soft felted hammer tone, gentle left-hand arpeggios, " +
  "building romantic hopeful feeling, Joe Hisaishi and Yiruma influence, no drums, " +
  "no vocals, Makoto Shinkai anime romance score";
const NARRATION_VOICE = "af_bella";

// ─── Replicate helpers (same as orchestrator) ──────────────────────────────

async function kokoroTts(text: string, voice: string, outPath: string): Promise<void> {
  console.log(`→ TTS: ${text.slice(0, 40)}…`);
  let submitRes: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${REPLICATE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version: KOKORO_VERSION, input: { text, voice, speed: 0.92 } }),
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
  const submitData = (await submitRes!.json()) as { urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${REPLICATE_KEY}` } });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return;
    }
    if (data.status === "failed") throw new Error(`kokoro failed: ${data.error}`);
  }
  throw new Error("kokoro timed out");
}

async function musicgen(prompt: string, duration: number, outPath: string): Promise<void> {
  console.log(`→ musicgen ${duration}s`);
  let submitRes: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${REPLICATE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: MUSICGEN_VERSION,
        input: { prompt, duration, model_version: "stereo-melody-large", output_format: "mp3", normalization_strategy: "peak" },
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
  const submitData = (await submitRes!.json()) as { urls?: { get: string } };
  const pollUrl = submitData.urls?.get!;
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${REPLICATE_KEY}` } });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      writeFileSync(outPath, Buffer.from(await audioRes.arrayBuffer()));
      console.log(`  ✓ ${(readFileSync(outPath).length / 1024).toFixed(0)} KB`);
      return;
    }
    if (data.status === "failed") throw new Error(`musicgen failed: ${data.error}`);
  }
  throw new Error("musicgen timed out");
}

function escDrawtext(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Resume test run (GOLDEN HOUR GRACE) ===\n");
  const tmp = mkdtempSync(join(tmpdir(), "anim-resume-"));
  const ffmpeg = ffmpegPath || "ffmpeg";

  // Download shots (with retry — tempfile CDN is flaky)
  console.log("→ downloading shots");
  const shotPaths: string[] = [];
  for (let i = 0; i < SHOT_URLS.length; i++) {
    let buf: Buffer | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const dl = await fetch(SHOT_URLS[i]!);
        if (!dl.ok) throw new Error(`HTTP ${dl.status}`);
        buf = Buffer.from(await dl.arrayBuffer());
        break;
      } catch (e) {
        console.log(`  ! shot ${i} attempt ${attempt + 1}: ${e instanceof Error ? e.message : e}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (!buf) throw new Error(`shot ${i}: all retries failed`);
    const p = join(tmp, `shot-${i}.mp4`);
    writeFileSync(p, buf);
    shotPaths.push(p);
    console.log(`  ✓ ${i}: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

    // Archive to R2
    await put(`${R2_PREFIX}/shots/${SCENES[i]!.id}.mp4`, buf, {
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
  }

  // Generate audio in parallel
  console.log("\n→ audio (parallel)");
  const bgmPath = join(tmp, "bgm.mp3");
  const narr0Path = join(tmp, "narr-0.wav");
  const narr1Path = join(tmp, "narr-1.wav");

  const totalSec = 2 + 8 + 8 + 2;  // open + shots + end

  await Promise.all([
    musicgen(MUSIC_PROMPT, totalSec + 2, bgmPath),
    kokoroTts(SCENES[0]!.narration, NARRATION_VOICE, narr0Path),
    kokoroTts(SCENES[1]!.narration, NARRATION_VOICE, narr1Path),
  ]);

  // ffmpeg compose
  console.log("\n→ ffmpeg compose");
  const finalLocal = "/Users/wlin/dev/x-post-scheduler/public/videos/animation-golden-hour-grace.mp4";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";

  const shotFilters = SCENES.map((s, i) =>
    `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
    `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
    `trim=duration=${s.duration},setpts=PTS-STARTPTS,` +
    `fade=t=in:st=0:d=0.5,fade=t=out:st=${s.duration - 0.5}:d=0.5[v${i}]`
  );

  const openFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='${escDrawtext(OPENING_TITLE)}':fontcolor=white:fontsize=60:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'[vopen]`;

  const endFilter =
    `color=c=black:s=720x1280:d=2:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='${escDrawtext(END_CARD)}':fontcolor=white:fontsize=46:` +
    `x=(w-text_w)/2:y=(h-text_h)/2:` +
    `alpha='if(lt(t,0.6),t/0.6,if(gt(t,1.4),max(0,1-(t-1.4)/0.6),1))'[vend]`;

  const concatV = `[vopen][v0][v1][vend]concat=n=4:v=1:a=0[vout]`;

  // Audio:
  //   inputs 0,1 = video (no audio used)
  //   input 2 = bgm
  //   input 3 = narration 0 (starts at t=2s after opening)
  //   input 4 = narration 1 (starts at t=10s)
  const audioFilter =
    `[2:a]volume=0.30,afade=t=in:st=0:d=1.5,afade=t=out:st=${totalSec - 2}:d=2.0,apad=whole_dur=${totalSec}[bgmA];` +
    `[3:a]adelay=2300|2300,volume=1.4[narA0];` +
    `[4:a]adelay=10300|10300,volume=1.4[narA1];` +
    `[bgmA][narA0][narA1]amix=inputs=3:duration=first:dropout_transition=0,alimiter=limit=0.97[aout]`;

  const filterComplex = [...shotFilters, openFilter, endFilter, concatV, audioFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", shotPaths[0]!,
      "-i", shotPaths[1]!,
      "-i", bgmPath,
      "-i", narr0Path,
      "-i", narr1Path,
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
  console.log(`  ✓ ${(readFileSync(finalLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // Upload
  console.log("\n→ upload");
  const uploaded = await put(
    `${R2_PREFIX}/final.mp4`,
    readFileSync(finalLocal),
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  console.log("\n========================================");
  console.log(`✓ Final:  ${finalLocal}`);
  console.log(`🎬 R2:    ${uploaded.url}`);
}

main().catch((e) => {
  if (e instanceof Error && "stderr" in e) {
    console.error("\nffmpeg stderr (last 2500 chars):");
    console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2500));
  }
  console.error("\nFatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
