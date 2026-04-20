/**
 * Generic animation orchestrator.
 *
 * Given an AnimationPlan, produces a finished vertical anime short:
 *   1. Generate keyframes (OpenRouter Seedream 4.5 — free)
 *   2. Generate i2v shots (Seedance 2.0 — ~$0.075/sec)
 *   3. Generate narration per-scene (Replicate Kokoro)
 *   4. Generate BGM (Replicate musicgen)
 *   5. ffmpeg compose: opening card → scenes with xfade + mixed audio → end card
 *   6. Upload final to R2
 *
 * This is the generic version of the romance-anime scripts. It replaces all
 * the per-project scripts we wrote by hand.
 */
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { put } from "../r2";
import { generateGeminiImage, type GeminiImageResult } from "./gemini-image";
import { submitSeedanceVideoTask, getSeedanceVideoTask } from "../seedance";
import type { AnimationPlan, AnimationScene } from "./types";

const REPLICATE_KEY_ENV = "REPLICATE_API_KEY";
const KOKORO_VERSION =
  "f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";
const MUSICGEN_VERSION =
  "671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb";

export type OrchestrateOptions = {
  plan: AnimationPlan;
  /** R2 prefix (e.g. "animation/jobs/{jobId}"). Used for keyframes, shots, audio, final. */
  r2Prefix: string;
  /** Optional local path for the final MP4. */
  outputLocalPath?: string;
  /** Called after each major step, for progress tracking. */
  onProgress?: (step: string, detail?: string) => void;
};

export type OrchestrateResult = {
  finalUrl: string;
  finalLocalPath?: string;
  keyframes: { id: string; url: string }[];
  shots: { id: string; url: string }[];
  bgmUrl: string;
  narrationUrls: { id: string; url: string }[];
  durationSec: number;
};

// ─── Step 1: keyframe (OpenRouter Seedream, free) ───────────────────────────

async function generateKeyframe(
  scene: AnimationScene,
  r2Prefix: string,
  referenceImage?: GeminiImageResult,
): Promise<{ url: string; image: GeminiImageResult }> {
  // When a reference image is provided (from scene 0), Gemini uses
  // subject-driven generation — same characters, new scene. This is the
  // critical trick for character consistency across scenes.
  const promptWithRef = referenceImage
    ? `Using the same exact characters from the reference image (preserve their faces, hair, clothing, and all distinctive features identically), generate a new scene: ${scene.imagePrompt}`
    : scene.imagePrompt;

  const img = await generateGeminiImage({
    prompt: promptWithRef,
    referenceImage,
  });
  const uploaded = await put(
    `${r2Prefix}/keyframes/${scene.id}.png`,
    img.buffer,
    { contentType: img.mimeType, addRandomSuffix: false },
  );
  return { url: uploaded.url, image: img };
}

// ─── Step 2: Seedance 2.0 i2v ───────────────────────────────────────────────

async function generateShot(scene: AnimationScene, referenceUrl: string, r2Prefix: string): Promise<string> {
  const submitted = await submitSeedanceVideoTask({
    modelId: "seedance-2.0/image-to-video",
    prompt: scene.motionPrompt,
    imageUrl: referenceUrl,
    aspectRatio: "9:16",
    duration: scene.duration,
    lockCamera: false,
    generateAudio: false,
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 25 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const polled = await getSeedanceVideoTask(submitted.id);
    if (polled.status === "completed" && polled.outputs?.[0]) {
      // Mirror to R2 for archival / stable URL
      const dl = await fetch(polled.outputs[0]);
      if (!dl.ok) throw new Error(`download ${scene.id}: ${dl.status}`);
      const buf = Buffer.from(await dl.arrayBuffer());
      const uploaded = await put(
        `${r2Prefix}/shots/${scene.id}.mp4`,
        buf,
        { contentType: "video/mp4", addRandomSuffix: false },
      );
      return uploaded.url;
    }
    if (polled.status === "failed") {
      throw new Error(`Seedance ${scene.id} failed: ${polled.error}`);
    }
  }
  throw new Error(`Seedance ${scene.id} timed out`);
}

// ─── Step 3: Kokoro TTS narration (with 429 retry) ──────────────────────────

async function generateNarration(text: string, voice: string, r2Prefix: string, sceneId: string): Promise<{ url: string; localBuf: Buffer }> {
  const key = process.env[REPLICATE_KEY_ENV];
  if (!key) throw new Error(`${REPLICATE_KEY_ENV} not set`);

  let submitRes: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: KOKORO_VERSION,
        input: { text, voice, speed: 0.92 },
      }),
    });
    if (submitRes.ok) break;
    if (submitRes.status === 429) {
      const body = await submitRes.text();
      const m = body.match(/resets in ~(\d+)s/);
      const wait = m ? parseInt(m[1]!) + 2 : 15;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`kokoro submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("kokoro retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) throw new Error("kokoro no poll URL");

  const startedAt = Date.now();
  while (Date.now() - startedAt < 5 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${key}` } });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      const buf = Buffer.from(await audioRes.arrayBuffer());
      const uploaded = await put(
        `${r2Prefix}/narration/${sceneId}.wav`,
        buf,
        { contentType: "audio/wav", addRandomSuffix: false },
      );
      return { url: uploaded.url, localBuf: buf };
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`kokoro ${data.status}: ${data.error}`);
    }
  }
  throw new Error("kokoro timed out");
}

// ─── Step 4: musicgen BGM ───────────────────────────────────────────────────

async function generateBgm(prompt: string, durationSec: number, r2Prefix: string): Promise<{ url: string; localBuf: Buffer }> {
  const key = process.env[REPLICATE_KEY_ENV];
  if (!key) throw new Error(`${REPLICATE_KEY_ENV} not set`);

  let submitRes: Response | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    submitRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
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
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`musicgen submit: ${await submitRes.text()}`);
  }
  if (!submitRes!.ok) throw new Error("musicgen retries exhausted");

  const submitData = (await submitRes!.json()) as { id: string; urls?: { get: string } };
  const pollUrl = submitData.urls?.get;
  if (!pollUrl) throw new Error("musicgen no poll URL");

  const startedAt = Date.now();
  while (Date.now() - startedAt < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollRes = await fetch(pollUrl, { headers: { Authorization: `Token ${key}` } });
    if (!pollRes.ok) continue;
    const data = (await pollRes.json()) as { status?: string; output?: string | string[]; error?: string };
    if (data.status === "succeeded" && data.output) {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const audioRes = await fetch(url);
      const buf = Buffer.from(await audioRes.arrayBuffer());
      const uploaded = await put(
        `${r2Prefix}/bgm.mp3`,
        buf,
        { contentType: "audio/mpeg", addRandomSuffix: false },
      );
      return { url: uploaded.url, localBuf: buf };
    }
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(`musicgen ${data.status}: ${data.error}`);
    }
  }
  throw new Error("musicgen timed out");
}

// ─── Step 5: ffmpeg compose ─────────────────────────────────────────────────

function escDrawtext(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function compose(args: {
  plan: AnimationPlan;
  shotPaths: string[];
  narrationPaths: (string | null)[];   // one per scene (null if no narration)
  bgmPath: string;
  outputPath: string;
}): void {
  const ffmpeg = ffmpegPath || "ffmpeg";
  const FONT = "/System/Library/Fonts/Helvetica.ttc";
  const { plan, shotPaths, narrationPaths, bgmPath, outputPath } = args;

  const hasOpening = Boolean(plan.openingTitle);
  const hasEnd = Boolean(plan.endCard);
  const openingDur = hasOpening ? 2 : 0;
  const endDur = hasEnd ? 2 : 0;

  const totalVideoSec =
    openingDur +
    plan.scenes.reduce((s, sc) => s + sc.duration, 0) +
    endDur;

  // Build video filter chain.
  const videoFilters: string[] = [];

  // Normalize each shot to 720x1280, trim to scene duration, fade in/out slight
  plan.scenes.forEach((scene, i) => {
    videoFilters.push(
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,` +
      `pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p,` +
      `trim=duration=${scene.duration},setpts=PTS-STARTPTS,` +
      `fade=t=in:st=0:d=0.5,fade=t=out:st=${scene.duration - 0.5}:d=0.5[v${i}]`,
    );
  });

  if (hasOpening) {
    videoFilters.push(
      `color=c=black:s=720x1280:d=${openingDur}:r=30,format=yuv420p,` +
      `drawtext=fontfile=${FONT}:text='${escDrawtext(plan.openingTitle!)}':fontcolor=white:fontsize=72:` +
      `x=(w-text_w)/2:y=(h-text_h)/2-30:` +
      `alpha='if(lt(t,0.6),t/0.6,if(gt(t,${openingDur - 0.6}),max(0,1-(t-${openingDur - 0.6})/0.6),1))'` +
      (plan.subtitle
        ? `,drawtext=fontfile=${FONT}:text='${escDrawtext(plan.subtitle)}':fontcolor=0xc8c8c8:fontsize=30:` +
          `x=(w-text_w)/2:y=(h-text_h)/2+50:` +
          `alpha='if(lt(t,0.9),max(0,(t-0.3)/0.6),if(gt(t,${openingDur - 0.6}),max(0,1-(t-${openingDur - 0.6})/0.6),1))'`
        : "") +
      `[vopen]`,
    );
  }

  if (hasEnd) {
    videoFilters.push(
      `color=c=black:s=720x1280:d=${endDur}:r=30,format=yuv420p,` +
      `drawtext=fontfile=${FONT}:text='${escDrawtext(plan.endCard!)}':fontcolor=white:fontsize=46:` +
      `x=(w-text_w)/2:y=(h-text_h)/2:` +
      `alpha='if(lt(t,0.6),t/0.6,if(gt(t,${endDur - 0.6}),max(0,1-(t-${endDur - 0.6})/0.6),1))'` +
      `[vend]`,
    );
  }

  // Video concat: [vopen] + [v0][v1]...[vN] + [vend]
  const vInputs: string[] = [];
  if (hasOpening) vInputs.push("[vopen]");
  plan.scenes.forEach((_, i) => vInputs.push(`[v${i}]`));
  if (hasEnd) vInputs.push("[vend]");
  const nV = vInputs.length;
  videoFilters.push(`${vInputs.join("")}concat=n=${nV}:v=1:a=0[vout]`);

  // Audio: BGM covers entire video, narrations overlaid at scene offsets.
  // ffmpeg input indices: 0..(N_scenes-1)=video, N=bgm, N+1..=narrations
  const nScenes = plan.scenes.length;
  const bgmIdx = nScenes;
  const narrFirstIdx = bgmIdx + 1;

  const audioFilters: string[] = [];

  // BGM: volume 0.30, fade in/out
  audioFilters.push(
    `[${bgmIdx}:a]volume=0.30,afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, totalVideoSec - 2)}:d=2.0,apad=whole_dur=${totalVideoSec}[bgmA]`,
  );

  // Narrations: delay each by cumulative scene offset (opening + prior scenes)
  const narrStreams: string[] = [];
  let currentOffset = openingDur;
  let narrFileIdx = 0;
  plan.scenes.forEach((scene, i) => {
    if (scene.narration && narrationPaths[i]) {
      const delayMs = Math.round((currentOffset + 0.3) * 1000);  // +0.3s grace
      const tag = `narA${i}`;
      audioFilters.push(
        `[${narrFirstIdx + narrFileIdx}:a]adelay=${delayMs}|${delayMs},volume=1.4[${tag}]`,
      );
      narrStreams.push(`[${tag}]`);
      narrFileIdx++;
    }
    currentOffset += scene.duration;
  });

  // Mix BGM with all narration streams
  if (narrStreams.length > 0) {
    audioFilters.push(
      `[bgmA]${narrStreams.join("")}amix=inputs=${1 + narrStreams.length}:duration=first:dropout_transition=0,alimiter=limit=0.97[aout]`,
    );
  } else {
    audioFilters.push(`[bgmA]alimiter=limit=0.97[aout]`);
  }

  const filterComplex = [...videoFilters, ...audioFilters].join(";");

  // Build input args
  const inputArgs: string[] = [];
  shotPaths.forEach((p) => {
    inputArgs.push("-i", p);
  });
  inputArgs.push("-i", bgmPath);
  narrationPaths.forEach((p) => {
    if (p) inputArgs.push("-i", p);
  });

  execFileSync(
    ffmpeg,
    [
      ...inputArgs,
      "-filter_complex", filterComplex,
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

// ─── Main entrypoint ────────────────────────────────────────────────────────

export async function orchestrateAnimation(opts: OrchestrateOptions): Promise<OrchestrateResult> {
  const { plan, r2Prefix } = opts;
  const progress = opts.onProgress ?? (() => {});
  const tmp = mkdtempSync(join(tmpdir(), "anim-"));

  const totalVideoSec =
    (plan.openingTitle ? 2 : 0) +
    plan.scenes.reduce((s, sc) => s + sc.duration, 0) +
    (plan.endCard ? 2 : 0);

  // 1. Keyframes — SEQUENTIAL to preserve character consistency:
  //    Scene 0 = fresh generation (establishes characters).
  //    Scenes 1..N = generated with scene 0 as reference image, so Gemini
  //    produces new scenes using the SAME characters. This trades some
  //    parallelism (~10s per scene) for consistency.
  progress("keyframes", `generating ${plan.scenes.length} keyframes (anchored)`);
  const keyframeUrls: string[] = [];
  let anchorImage: GeminiImageResult | undefined;
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i]!;
    const result = await generateKeyframe(scene, r2Prefix, anchorImage);
    keyframeUrls.push(result.url);
    if (i === 0) {
      // Use scene 0 as the anchor for subsequent scenes
      anchorImage = result.image;
    }
    progress("keyframes", `${i + 1}/${plan.scenes.length}: ${scene.id}`);
  }

  // 2. Shots + audio in parallel.
  // Seedance shots: one per scene. Narrations: one per scene with narration. BGM: one.
  progress("shots-audio", `submitting ${plan.scenes.length} shots + audio`);
  const narrationTasks = plan.scenes.map((s) =>
    s.narration
      ? generateNarration(s.narration, plan.narrationVoice, r2Prefix, s.id)
      : Promise.resolve(null),
  );
  const bgmTask = generateBgm(plan.musicPrompt, Math.max(8, totalVideoSec + 2), r2Prefix);
  const shotTasks = plan.scenes.map((s, i) => generateShot(s, keyframeUrls[i]!, r2Prefix));

  const [shotUrls, narrationResults, bgmResult] = await Promise.all([
    Promise.all(shotTasks),
    Promise.all(narrationTasks),
    bgmTask,
  ]);

  progress("download", "downloading shots");

  // 3. Download all shots, narrations, bgm to local tmp for ffmpeg
  const shotPaths: string[] = [];
  for (let i = 0; i < shotUrls.length; i++) {
    const dl = await fetch(shotUrls[i]!);
    const buf = Buffer.from(await dl.arrayBuffer());
    const p = join(tmp, `shot-${i}.mp4`);
    writeFileSync(p, buf);
    shotPaths.push(p);
  }

  const narrationPaths: (string | null)[] = [];
  narrationResults.forEach((r, i) => {
    if (r) {
      const p = join(tmp, `narration-${i}.wav`);
      writeFileSync(p, r.localBuf);
      narrationPaths.push(p);
    } else {
      narrationPaths.push(null);
    }
  });

  const bgmPath = join(tmp, "bgm.mp3");
  writeFileSync(bgmPath, bgmResult.localBuf);

  // 4. Compose
  progress("compose", "ffmpeg composition");
  const finalLocalPath = opts.outputLocalPath ?? join(tmp, "final.mp4");
  compose({
    plan,
    shotPaths,
    narrationPaths,
    bgmPath,
    outputPath: finalLocalPath,
  });

  // 5. Upload final
  progress("upload", "uploading to R2");
  const finalBuf = readFileSync(finalLocalPath);
  const uploaded = await put(
    `${r2Prefix}/final.mp4`,
    finalBuf,
    { contentType: "video/mp4", addRandomSuffix: false },
  );

  progress("done", "animation complete");

  return {
    finalUrl: uploaded.url,
    finalLocalPath: opts.outputLocalPath ? opts.outputLocalPath : undefined,
    keyframes: plan.scenes.map((s, i) => ({ id: s.id, url: keyframeUrls[i]! })),
    shots: plan.scenes.map((s, i) => ({ id: s.id, url: shotUrls[i]! })),
    bgmUrl: bgmResult.url,
    narrationUrls: plan.scenes
      .map((s, i) => narrationResults[i] ? { id: s.id, url: narrationResults[i]!.url } : null)
      .filter((x): x is { id: string; url: string } => x !== null),
    durationSec: totalVideoSec,
  };
}
