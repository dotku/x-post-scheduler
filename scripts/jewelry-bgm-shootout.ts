/**
 * BGM shootout — generate 3 candidate background music tracks for v6 and
 * remix the existing v6 video with each. No video re-spend.
 *
 * Candidates:
 *   A. Meta MusicGen (stereo-large) — original setup, refined prompt
 *   B. Meta MusicGen (stereo-melody-large) — original model, all-new prompt
 *   C. Stable Audio Open 1.0 — newer model, 44.1kHz hi-fi, negative prompt
 *
 * Each result is uploaded to R2 + a remixed video is produced for A/B/C.
 * Existing v6 raw assets are pulled from R2 (no Vidu re-spend).
 *
 * Cost: ~$0.15 (3 audio generations)
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const REPLICATE_KEY = process.env.REPLICATE_API_KEY;
if (!REPLICATE_KEY) {
  console.error("ERROR: REPLICATE_API_KEY missing");
  process.exit(1);
}

// ─── Existing v6 assets ────────────────────────────────────────────────────

const V6_RAW_VIDEO = "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase6/raw-shot.mp4";

// ─── Music model versions ──────────────────────────────────────────────────

const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
const STABLE_AUDIO_VERSION = "9aff84a639f96d0f7e6081cdea002d15133d0043727f849c40abdd166b7c75a8";

// ─── BGM candidate prompts ─────────────────────────────────────────────────

type BgmCandidate = {
  label: string;
  model: "musicgen" | "stable-audio";
  modelVersion: string;
  // For musicgen
  modelVariant?: "stereo-melody-large" | "stereo-large";
  prompt: string;
  negativePrompt?: string;
};

// All candidates target 12 seconds. The video body is 12s + 2s title card =
// 14s, so we'll generate 14s of audio for each.
const TOTAL_AUDIO_SEC = 14;

const CANDIDATES: BgmCandidate[] = [
  {
    label: "A-musicgen-stereo-large-warm",
    model: "musicgen",
    modelVersion: MUSICGEN_VERSION,
    modelVariant: "stereo-large",
    prompt:
      "Cinematic luxury jewelry brand commercial, lush warm orchestral " +
      "ambient pad swelling slowly, ethereal female 'ahh' choir hum, " +
      "deep velvet sub-bass drone, soft gentle glass harp arpeggios floating " +
      "in the upper register, no percussion, no drums, no vocals with words, " +
      "60 BPM, emotional aspirational mood, hyper-minimal production, " +
      "designed for a Cartier Panthère winter advertisement, dreamy, " +
      "spacious reverb",
  },
  {
    label: "B-musicgen-melody-tinkling",
    model: "musicgen",
    modelVersion: MUSICGEN_VERSION,
    modelVariant: "stereo-melody-large",
    prompt:
      "Slow elegant solo grand piano playing a sparse aspirational melody " +
      "with delicate crystal glass chimes ringing between phrases, soft warm " +
      "string ensemble fading in and out underneath, ambient hall reverb, " +
      "60 BPM, no drums, no vocals, intimate luxury jewelry commercial " +
      "soundtrack in the style of Bulgari or Tiffany advertising, emotional " +
      "and refined",
  },
  {
    label: "C-stable-audio-open-cinematic",
    model: "stable-audio",
    modelVersion: STABLE_AUDIO_VERSION,
    prompt:
      "Cinematic luxury jewelry commercial soundtrack, slow gentle solo " +
      "piano arpeggios with high crystal glass chimes, warm string pad swell " +
      "underneath, soft female ahh choir, deep cinematic sub-bass, ambient " +
      "hall reverb, 60 BPM, peaceful aspirational, Cartier Panthère winter " +
      "ad, no drums, no percussion",
    negativePrompt:
      "drums, percussion, beat, vocals with words, harsh, distorted, lo-fi, " +
      "8-bit, electronic dance, trap, hip hop",
  },
];

// ─── Generation helpers ────────────────────────────────────────────────────

async function pollReplicate(pollUrl: string, label: string): Promise<string> {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(pollUrl, {
      headers: { Authorization: `Token ${REPLICATE_KEY}` },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status !== lastStatus) {
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      console.log(`  [${label}] [${elapsed}s] status=${data.status}`);
      lastStatus = data.status || "";
    }
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      return url;
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`${label} ${data.status}: ${data.error || ""}`);
    }
  }
  throw new Error(`${label} timed out`);
}

async function runMusicgen(c: BgmCandidate): Promise<string> {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: c.modelVersion,
      input: {
        prompt: c.prompt,
        duration: TOTAL_AUDIO_SEC,
        model_version: c.modelVariant,
        output_format: "mp3",
        normalization_strategy: "loudness",
      },
    }),
  });
  if (!res.ok) throw new Error(`musicgen submit (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { id: string; urls?: { get: string } };
  if (!data.urls?.get) throw new Error("musicgen no poll URL");
  console.log(`  [${c.label}] submitted: ${data.id}`);
  return pollReplicate(data.urls.get, c.label);
}

async function runStableAudio(c: BgmCandidate): Promise<string> {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: c.modelVersion,
      input: {
        prompt: c.prompt,
        seconds_total: TOTAL_AUDIO_SEC,
        steps: 100,
        cfg_scale: 6,
        negative_prompt: c.negativePrompt || "",
      },
    }),
  });
  if (!res.ok) throw new Error(`stable-audio submit (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { id: string; urls?: { get: string } };
  if (!data.urls?.get) throw new Error("stable-audio no poll URL");
  console.log(`  [${c.label}] submitted: ${data.id}`);
  return pollReplicate(data.urls.get, c.label);
}

async function generateAudio(c: BgmCandidate): Promise<string> {
  return c.model === "musicgen" ? runMusicgen(c) : runStableAudio(c);
}

// ─── ffmpeg remix helper ───────────────────────────────────────────────────

async function remixV6WithBgm(
  ffmpeg: string,
  rawVideoPath: string,
  bgmPath: string,
  outputPath: string,
): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), "remix-"));

  // Step A: re-do the snow + reverse loop pipeline (same as Phase 6)
  // 1. Reverse 6s
  const reversed = join(tmp, "reversed.mp4");
  execFileSync(
    ffmpeg,
    ["-i", rawVideoPath, "-vf", "reverse", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", "-y", reversed],
    { stdio: "pipe" },
  );

  // 2. Concat to 12s loop
  const concatList = join(tmp, "loop.txt");
  writeFileSync(concatList, `file '${rawVideoPath}'\nfile '${reversed}'\n`);
  const looped = join(tmp, "looped.mp4");
  execFileSync(
    ffmpeg,
    ["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-an", "-y", looped],
    { stdio: "pipe" },
  );

  // 3. Snow + ken burns + fade (same as Phase 6)
  const TOTAL = 12;
  const SNOW_COUNT = 28;

  // Build deterministic snow chain
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const normalizeFilter =
    `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:` +
    `(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,trim=duration=${TOTAL},setpts=PTS-STARTPTS[norm]`;

  const snowFilters: string[] = [];
  let prev = "norm";
  for (let i = 0; i < SNOW_COUNT; i++) {
    const isFront = rand() > 0.6;
    const startX = Math.floor(rand() * 720);
    const fallSpeed = isFront ? 130 + rand() * 70 : 50 + rand() * 50;
    const startTime = -2 + rand() * (TOTAL + 2);
    const size = isFront ? 5 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 3);
    const alpha = isFront ? 0.65 + rand() * 0.25 : 0.35 + rand() * 0.25;
    const driftAmp = 6 + rand() * 18;
    const driftFreq = 0.4 + rand() * 1.0;
    const xExpr = `${startX}+${driftAmp.toFixed(1)}*sin((t-(${startTime.toFixed(2)}))*${driftFreq.toFixed(2)})`;
    const yExpr = `-20+(t-(${startTime.toFixed(2)}))*${fallSpeed.toFixed(0)}`;
    const next = `s${i}`;
    snowFilters.push(
      `[${prev}]drawbox=x='${xExpr}':y='${yExpr}':w=${size}:h=${size}:color=white@${alpha.toFixed(2)}:t=fill[${next}]`,
    );
    prev = next;
  }

  const kbFilter = `[${prev}]scale=770:1370,crop=720:1280:25:'25+(t/${TOTAL})*15'[kb]`;
  const fadeFilter = `[kb]fade=t=in:st=0:d=0.5,fade=t=out:st=${TOTAL - 0.5}:d=0.5[vfinal]`;

  const videoOnlyLocal = join(tmp, "video-only.mp4");
  const videoFilter = [normalizeFilter, snowFilters.join(";"), kbFilter, fadeFilter].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", looped,
      "-filter_complex", videoFilter,
      "-map", `[vfinal]`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-r", "30",
      "-an",
      "-y", videoOnlyLocal,
    ],
    { stdio: "pipe" },
  );

  // 4. Title card + cross-fade + BGM mix
  const FONT = "/System/Library/Fonts/Helvetica.ttc";
  const titleFilter =
    `color=c=black:s=720x1280:d=2.5:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='JmodelsJewelry':fontcolor=white:fontsize=58:` +
    `x=(w-text_w)/2:y=(h-text_h)/2-20:alpha='if(lt(t\\,0.4)\\,t/0.4\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))',` +
    `drawtext=fontfile=${FONT}:text='Crafted with brilliance':fontcolor=0xb0b0b0:fontsize=28:` +
    `x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t\\,0.6)\\,max(0\\,(t-0.2)/0.4)\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))'`;

  const finalFilter = [
    `[0:v]format=yuv420p,fps=30,trim=duration=12,setpts=PTS-STARTPTS[body]`,
    `${titleFilter}[title]`,
    `[body][title]xfade=transition=fade:duration=0.5:offset=11.5[vout]`,
    `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=12.5:d=1.5,alimiter=limit=0.95[aout]`,
  ].join(";");

  execFileSync(
    ffmpeg,
    [
      "-i", videoOnlyLocal,
      "-i", bgmPath,
      "-filter_complex", finalFilter,
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264", "-preset", "slow", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
      "-shortest",
      "-y", outputPath,
    ],
    { stdio: "pipe" },
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== BGM Shootout — 3 candidates for Phase 6 ===\n");
  const ffmpeg = ffmpegPath || "ffmpeg";
  const tmp = mkdtempSync(join(tmpdir(), "bgm-shootout-"));

  // 1. Download v6 raw video once
  console.log("→ Downloading v6 raw video from R2...");
  const rawRes = await fetch(V6_RAW_VIDEO);
  if (!rawRes.ok) throw new Error(`raw download (${rawRes.status})`);
  const rawLocal = join(tmp, "raw.mp4");
  writeFileSync(rawLocal, Buffer.from(await rawRes.arrayBuffer()));
  console.log(`  ✓ ${(readFileSync(rawLocal).length / 1024 / 1024).toFixed(2)} MB`);

  // 2. Run BGM generations SERIALLY with 11s delay between musicgen calls
  // (Replicate limits accounts <$5 credit to 6 req/min with burst of 1)
  console.log("\n→ Generating 3 BGM candidates serially (11s delay between)");
  const bgmResults: Array<
    | { c: BgmCandidate; localPath: string; ok: true; elapsed: number }
    | { c: BgmCandidate; localPath: ""; ok: false; error: string }
  > = [];
  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i];
    if (i > 0) {
      console.log("  · waiting 11s for Replicate rate limit...");
      await new Promise((r) => setTimeout(r, 11000));
    }
    bgmResults.push(await (async () => {
      const startedAt = Date.now();
      try {
        const url = await generateAudio(c);
        const dlRes = await fetch(url);
        if (!dlRes.ok) throw new Error(`download (${dlRes.status})`);
        const buf = Buffer.from(await dlRes.arrayBuffer());
        const ext = url.includes(".wav") ? "wav" : "mp3";
        const localPath = join(tmp, `${c.label}.${ext}`);
        writeFileSync(localPath, buf);
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        console.log(`  ✓ ${c.label}: ${(buf.length / 1024).toFixed(0)} KB (${elapsed}s)`);
        return { c, localPath, ok: true as const, elapsed };
      } catch (e) {
        console.error(`  ✗ ${c.label}: ${e instanceof Error ? e.message : e}`);
        return { c, localPath: "", ok: false as const, error: String(e) };
      }
    })());
  }

  // 3. For each successful BGM, remix v6 + upload
  console.log("\n→ Remixing v6 with each BGM");
  const finalResults: { label: string; remixUrl?: string; bgmUrl?: string; error?: string }[] = [];

  for (const r of bgmResults) {
    if (!r.ok) {
      finalResults.push({ label: r.c.label, error: r.error });
      continue;
    }
    try {
      console.log(`\n  → ${r.c.label}: remixing...`);
      const finalLocal = join(tmp, `${r.c.label}-final.mp4`);
      await remixV6WithBgm(ffmpeg, rawLocal, r.localPath, finalLocal);

      // Upload BGM + final
      const bgmExt = r.localPath.endsWith(".wav") ? "wav" : "mp3";
      const bgmUploaded = await put(
        `demo/jewelry-ad/phase6-bgm-shootout/${r.c.label}.${bgmExt}`,
        readFileSync(r.localPath),
        { contentType: bgmExt === "wav" ? "audio/wav" : "audio/mpeg", addRandomSuffix: false },
      );
      const finalUploaded = await put(
        `demo/jewelry-ad/phase6-bgm-shootout/v6-${r.c.label}.mp4`,
        readFileSync(finalLocal),
        { contentType: "video/mp4", addRandomSuffix: false },
      );
      console.log(`    ✓ BGM:   ${bgmUploaded.url}`);
      console.log(`    ✓ Remix: ${finalUploaded.url}`);
      finalResults.push({ label: r.c.label, remixUrl: finalUploaded.url, bgmUrl: bgmUploaded.url });
    } catch (e) {
      console.error(`  ✗ ${r.c.label} remix: ${e instanceof Error ? e.message : e}`);
      finalResults.push({ label: r.c.label, error: String(e) });
    }
  }

  console.log("\n========================================");
  console.log("✓ BGM Shootout complete");
  console.log("========================================");
  console.log("\n| Candidate | BGM URL | Remix URL |");
  console.log("|---|---|---|");
  for (const r of finalResults) {
    if (r.error) {
      console.log(`| ${r.label} | ❌ ${r.error} | — |`);
    } else {
      console.log(`| ${r.label} | ${r.bgmUrl} | ${r.remixUrl} |`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    if (e instanceof Error && "stderr" in e) {
      console.error("\nffmpeg stderr:");
      console.error((e as { stderr?: Buffer }).stderr?.toString().slice(-2000));
    }
    console.error("\nFatal:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
