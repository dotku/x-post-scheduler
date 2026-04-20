// Quick re-run of just A + B (musicgen variants) with proper rate limiting,
// since C (stable-audio) already succeeded earlier.

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { put } from "../lib/r2";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";

const REPLICATE_KEY = process.env.REPLICATE_API_KEY!;
const MUSICGEN_VERSION = "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";
const TOTAL_AUDIO_SEC = 14;

const PROMPTS = [
  {
    label: "A-musicgen-stereo-large-warm",
    variant: "stereo-large",
    prompt:
      "Cinematic luxury jewelry brand commercial, lush warm orchestral ambient pad swelling slowly, ethereal female ahh choir hum, deep velvet sub-bass drone, soft gentle glass harp arpeggios floating in the upper register, no percussion, no drums, no vocals with words, 60 BPM, emotional aspirational mood, hyper-minimal production, designed for a Cartier Panthere winter advertisement, dreamy, spacious reverb",
  },
  {
    label: "B-musicgen-melody-tinkling",
    variant: "stereo-melody-large",
    prompt:
      "Slow elegant solo grand piano playing a sparse aspirational melody with delicate crystal glass chimes ringing between phrases, soft warm string ensemble fading in and out underneath, ambient hall reverb, 60 BPM, no drums, no vocals, intimate luxury jewelry commercial soundtrack in the style of Bulgari or Tiffany advertising, emotional and refined",
  },
];

async function poll(pollUrl: string, label: string): Promise<string> {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(pollUrl, { headers: { Authorization: `Token ${REPLICATE_KEY}` } });
    if (!res.ok) continue;
    const data: any = await res.json();
    if (data.status !== lastStatus) {
      console.log(`  [${label}] [${Math.round((Date.now() - startedAt) / 1000)}s] ${data.status}`);
      lastStatus = data.status;
    }
    if (data.status === "succeeded" && data.output) {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }
    if (data.status === "failed") throw new Error(`${label}: ${data.error}`);
  }
  throw new Error(`${label} timeout`);
}

async function genMusicgen(p: typeof PROMPTS[0]): Promise<string> {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { Authorization: `Token ${REPLICATE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: MUSICGEN_VERSION,
      input: {
        prompt: p.prompt,
        duration: TOTAL_AUDIO_SEC,
        model_version: p.variant,
        output_format: "mp3",
        normalization_strategy: "loudness",
      },
    }),
  });
  if (!res.ok) throw new Error(`submit (${res.status}): ${await res.text()}`);
  const data: any = await res.json();
  console.log(`  [${p.label}] submitted: ${data.id}`);
  return poll(data.urls.get, p.label);
}

async function remix(rawVideoPath: string, bgmPath: string, outputPath: string) {
  const ffmpeg = ffmpegPath || "ffmpeg";
  const tmp = mkdtempSync(join(tmpdir(), "rmx-"));

  // Reverse + concat to 12s loop
  const reversed = join(tmp, "reversed.mp4");
  execFileSync(ffmpeg, ["-i", rawVideoPath, "-vf", "reverse", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", "-y", reversed], { stdio: "pipe" });

  const concatList = join(tmp, "loop.txt");
  writeFileSync(concatList, `file '${rawVideoPath}'\nfile '${reversed}'\n`);
  const looped = join(tmp, "looped.mp4");
  execFileSync(ffmpeg, ["-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", "-an", "-y", looped], { stdio: "pipe" });

  // Snow + ken burns + fade
  const TOTAL = 12;
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const SNOW = 28;
  const normalize = `[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,trim=duration=${TOTAL},setpts=PTS-STARTPTS[norm]`;
  const snowFilters: string[] = [];
  let prev = "norm";
  for (let i = 0; i < SNOW; i++) {
    const front = rand() > 0.6;
    const sx = Math.floor(rand() * 720);
    const fs = front ? 130 + rand() * 70 : 50 + rand() * 50;
    const st = -2 + rand() * (TOTAL + 2);
    const sz = front ? 5 + Math.floor(rand() * 4) : 3 + Math.floor(rand() * 3);
    const al = front ? 0.65 + rand() * 0.25 : 0.35 + rand() * 0.25;
    const da = 6 + rand() * 18;
    const df = 0.4 + rand() * 1.0;
    const xExpr = `${sx}+${da.toFixed(1)}*sin((t-(${st.toFixed(2)}))*${df.toFixed(2)})`;
    const yExpr = `-20+(t-(${st.toFixed(2)}))*${fs.toFixed(0)}`;
    const next = `s${i}`;
    snowFilters.push(`[${prev}]drawbox=x='${xExpr}':y='${yExpr}':w=${sz}:h=${sz}:color=white@${al.toFixed(2)}:t=fill[${next}]`);
    prev = next;
  }
  const kb = `[${prev}]scale=770:1370,crop=720:1280:25:'25+(t/${TOTAL})*15'[kb]`;
  const fade = `[kb]fade=t=in:st=0:d=0.5,fade=t=out:st=${TOTAL - 0.5}:d=0.5[vfinal]`;
  const videoOnly = join(tmp, "vo.mp4");
  execFileSync(ffmpeg, ["-i", looped, "-filter_complex", [normalize, snowFilters.join(";"), kb, fade].join(";"), "-map", "[vfinal]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-an", "-y", videoOnly], { stdio: "pipe" });

  // Title + BGM mix
  const FONT = "/System/Library/Fonts/Helvetica.ttc";
  const titleFilter =
    `color=c=black:s=720x1280:d=2.5:r=30,format=yuv420p,` +
    `drawtext=fontfile=${FONT}:text='JmodelsJewelry':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=(h-text_h)/2-20:alpha='if(lt(t\\,0.4)\\,t/0.4\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))',` +
    `drawtext=fontfile=${FONT}:text='Crafted with brilliance':fontcolor=0xb0b0b0:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+50:alpha='if(lt(t\\,0.6)\\,max(0\\,(t-0.2)/0.4)\\,if(gt(t\\,2.0)\\,max(0\\,1-(t-2.0)/0.4)\\,1))'`;
  const finalFilter = [
    `[0:v]format=yuv420p,fps=30,trim=duration=12,setpts=PTS-STARTPTS[body]`,
    `${titleFilter}[title]`,
    `[body][title]xfade=transition=fade:duration=0.5:offset=11.5[vout]`,
    `[1:a]volume=0.85,afade=t=in:st=0:d=1.5,afade=t=out:st=12.5:d=1.5,alimiter=limit=0.95[aout]`,
  ].join(";");
  execFileSync(ffmpeg, ["-i", videoOnly, "-i", bgmPath, "-filter_complex", finalFilter, "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-y", outputPath], { stdio: "pipe" });
}

async function main() {
  const tmp = mkdtempSync(join(tmpdir(), "ab-"));
  console.log("Downloading v6 raw...");
  const r = await fetch("https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase6/raw-shot.mp4");
  const raw = join(tmp, "raw.mp4");
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()));

  for (let i = 0; i < PROMPTS.length; i++) {
    const p = PROMPTS[i];
    if (i > 0) {
      console.log("  · waiting 12s for rate limit...");
      await new Promise((r) => setTimeout(r, 12000));
    }
    console.log(`\n[${i + 1}/${PROMPTS.length}] ${p.label}`);
    try {
      const url = await genMusicgen(p);
      const dlRes = await fetch(url);
      const audioBuf = Buffer.from(await dlRes.arrayBuffer());
      const audioLocal = join(tmp, `${p.label}.mp3`);
      writeFileSync(audioLocal, audioBuf);
      console.log(`  ✓ audio: ${(audioBuf.length / 1024).toFixed(0)} KB`);

      const audioR2 = await put(`demo/jewelry-ad/phase6-bgm-shootout/${p.label}.mp3`, audioBuf, { contentType: "audio/mpeg", addRandomSuffix: false });
      console.log(`  ✓ BGM R2: ${audioR2.url}`);

      const finalLocal = join(tmp, `${p.label}-final.mp4`);
      console.log(`  → remixing video...`);
      await remix(raw, audioLocal, finalLocal);
      const finalBuf = readFileSync(finalLocal);
      const finalR2 = await put(`demo/jewelry-ad/phase6-bgm-shootout/v6-${p.label}.mp4`, finalBuf, { contentType: "video/mp4", addRandomSuffix: false });
      console.log(`  ✓ Remix R2: ${finalR2.url}`);
    } catch (e) {
      console.error(`  ✗ ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("Fatal:", e); process.exit(1); });
