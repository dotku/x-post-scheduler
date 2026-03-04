import ffmpeg from "fluent-ffmpeg";
import explicitFfmpegPath from "ffmpeg-static";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";

// Configure ffmpeg path
let ffmpegPath = explicitFfmpegPath;

// Robust prompt to resolve ffmpeg path if default is missing or weird
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.warn(`[VideoStitch] ffmpeg-static path not found: ${ffmpegPath}`);
    // Try to find relative to cwd
    const localPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
    if (fs.existsSync(localPath)) {
        console.log(`[VideoStitch] Found local ffmpeg at: ${localPath}`);
        ffmpegPath = localPath;
    } else {
         // Try finding inside .next/server/node_modules if bundled?
         const bundledPath = path.join(process.cwd(), '.next/server/node_modules/ffmpeg-static/ffmpeg');
          if (fs.existsSync(bundledPath)) {
             console.log(`[VideoStitch] Found bundled ffmpeg at: ${bundledPath}`);
             ffmpegPath = bundledPath;
          }
    }
}

if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  console.log(`[VideoStitch] Using ffmpeg at: ${ffmpegPath}`);
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  console.error("[VideoStitch] FATAL: ffmpeg binary not found!");
}

interface VideoInfo {
  duration: number;
  hasAudio: boolean;
  width: number;
  height: number;
}

function getVideoInfo(filePath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const vs = metadata.streams.find((s) => s.codec_type === "video");
      const as = metadata.streams.find((s) => s.codec_type === "audio");
      resolve({
        duration: Number(metadata.format.duration) || 5,
        hasAudio: !!as,
        width: vs?.width || 1280,
        height: vs?.height || 720,
      });
    });
  });
}

/**
 * Extract the last frame of a video as a JPEG buffer.
 * Used to provide visual continuity between I2V segments.
 */
export async function extractLastFrame(videoUrl: string): Promise<Buffer> {
  const tempDir = os.tmpdir();
  const videoPath = path.join(tempDir, `framesrc-${randomUUID()}.mp4`);
  const framePath = path.join(tempDir, `lastframe-${randomUUID()}.jpg`);
  try {
    const resp = await fetch(videoUrl);
    if (!resp.ok) throw new Error(`Failed to download video: ${resp.status}`);
    fs.writeFileSync(videoPath, Buffer.from(await resp.arrayBuffer()));

    const info = await getVideoInfo(videoPath);
    const seekTime = Math.max(0, info.duration - 0.5);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(seekTime)
        .outputOptions(["-frames:v", "1", "-q:v", "2"])
        .output(framePath)
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });

    return fs.readFileSync(framePath);
  } finally {
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
    } catch {}
  }
}

export async function stitchVideos(videoUrls: string[]): Promise<string> {
  if (videoUrls.length < 2) {
    throw new Error("Need at least 2 videos to stitch");
  }

  const tempDir = os.tmpdir();
  const outputFileName = `stitched-${randomUUID()}.mp4`;
  const outputPath = path.join(tempDir, outputFileName);
  const inputPaths: string[] = [];

  try {
    // Download all videos to temp files
    console.log(`[Stitch] Downloading ${videoUrls.length} videos...`);
    
    for (let i = 0; i < videoUrls.length; i++) {
        const url = videoUrls[i];
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to download video ${i}: ${response.statusText}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const inputPath = path.join(tempDir, `input-${randomUUID()}-${i}.mp4`);
        fs.writeFileSync(inputPath, buffer);
        inputPaths.push(inputPath);
    }

    // Probe all clips for duration and audio presence
    const infos = await Promise.all(inputPaths.map(getVideoInfo));
    const n = inputPaths.length;
    const allHaveAudio = infos.every((info) => info.hasAudio);

    // Visual crossfade duration (0.5s) — creates a smooth blend between clips
    const XFADE_DURATION = 0.5;

    // Compute xfade offset for each splice point.
    // offset[i] = sum of durations[0..i] - XFADE_DURATION*(i+1)
    // This is the PTS (in the chained xfade output) at which transition i begins.
    let cumulative = 0;
    const xfadeOffsets: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      cumulative += infos[i].duration;
      xfadeOffsets.push(Math.max(0, cumulative - XFADE_DURATION * (i + 1)));
    }

    console.log(`[Stitch] Combining ${n} videos, audio=${allHaveAudio}, xfade offsets=${xfadeOffsets.map(o => o.toFixed(2)).join(",")}...`);

    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));

    await new Promise<void>((resolve, reject) => {
      const filterParts: string[] = [];

      // Video xfade chain — fade transition between consecutive clips
      for (let i = 0; i < n - 1; i++) {
        const leftLabel = i === 0 ? `[0:v]` : `[xv${i - 1}]`;
        const rightLabel = `[${i + 1}:v]`;
        const outLabel = i === n - 2 ? `[v]` : `[xv${i}]`;
        filterParts.push(
          `${leftLabel}${rightLabel}xfade=transition=fade:duration=${XFADE_DURATION}:offset=${xfadeOffsets[i].toFixed(3)}${outLabel}`,
        );
      }

      const outputOpts = [
        "-filter_complex", filterParts.join(";"),
        "-map", "[v]",
        "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-movflags", "+faststart",
      ];

      if (allHaveAudio) {
        // Audio acrossfade chain — matches visual crossfade duration to keep them in sync
        for (let i = 0; i < n - 1; i++) {
          const inA = i === 0 ? `[0:a][1:a]` : `[af${i - 1}][${i + 1}:a]`;
          const outA = i === n - 2 ? `[a]` : `[af${i}]`;
          filterParts.push(`${inA}acrossfade=d=${XFADE_DURATION}:c1=tri:c2=tri${outA}`);
        }
        // Rebuild filter_complex with audio filters included
        outputOpts[1] = filterParts.join(";");
        outputOpts.push("-map", "[a]", "-c:a", "aac", "-b:a", "128k");
      }

      command
        .outputOptions(outputOpts)
        .output(outputPath)
        .on("error", (err) => { console.error("[Stitch] FFMPEG error:", err); reject(err); })
        .on("end", () => { console.log("[Stitch] Processing finished successfully"); resolve(); })
        .run();
    });

    // Upload result to blob storage
    console.log(`[Stitch] Uploading result...`);
    const fileContent = fs.readFileSync(outputPath);
    
    let blob;
    try {
      // Try public access first
      blob = await put(`stitched/${outputFileName}`, fileContent, {
        access: "public",
        contentType: "video/mp4",
        addRandomSuffix: false
      });
    } catch (e: any) {
      if (e.message?.includes("private store")) {
        console.log(`[Stitch] Public access failed, falling back to private access...`);
        blob = await put(`stitched/${outputFileName}`, fileContent, {
          access: "private",
          contentType: "video/mp4", 
          addRandomSuffix: false
        });
      } else {
        throw e;
      }
    }

    return blob.url;
  } finally {
    // Cleanup temp files
    try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        inputPaths.forEach(p => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });
    } catch (e) {
        console.error("[Stitch] Cleanup error:", e);
    }
  }
}

// ── Enhanced stitch with trim, configurable crossfade, and BGM ──────────────

export interface StitchClipInput {
  url: string;
  trimStart?: number; // seconds, default 0
  trimEnd?: number;   // seconds, default full duration
}

export interface StitchOptions {
  clips: StitchClipInput[];
  crossfadeDuration?: number; // 0-2, default 0.5
  bgm?: {
    url: string;
    volume: number; // 0-100
  };
}

export async function stitchVideosWithTrim(options: StitchOptions): Promise<string> {
  const { clips, crossfadeDuration = 0.5, bgm } = options;
  if (clips.length < 2) throw new Error("Need at least 2 clips to stitch");

  const xfadeDur = Math.max(0, Math.min(2, crossfadeDuration));
  const tempDir = os.tmpdir();
  const outputFileName = `stitched-${randomUUID()}.mp4`;
  const outputPath = path.join(tempDir, outputFileName);
  const inputPaths: string[] = [];
  let bgmPath: string | null = null;

  try {
    // Download all clips
    console.log(`[StitchTrim] Downloading ${clips.length} clips...`);
    for (let i = 0; i < clips.length; i++) {
      const resp = await fetch(clips[i].url);
      if (!resp.ok) throw new Error(`Failed to download clip ${i}: ${resp.statusText}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const p = path.join(tempDir, `clip-${randomUUID()}-${i}.mp4`);
      fs.writeFileSync(p, buf);
      inputPaths.push(p);
    }

    // Download BGM if provided
    if (bgm?.url) {
      const bgmResp = await fetch(bgm.url);
      if (!bgmResp.ok) throw new Error(`Failed to download BGM: ${bgmResp.statusText}`);
      bgmPath = path.join(tempDir, `bgm-${randomUUID()}.mp3`);
      fs.writeFileSync(bgmPath, Buffer.from(await bgmResp.arrayBuffer()));
    }

    // Probe all clips
    const infos = await Promise.all(inputPaths.map(getVideoInfo));
    const n = clips.length;

    // Compute effective durations after trim
    const trimmedDurations: number[] = [];
    for (let i = 0; i < n; i++) {
      const start = clips[i].trimStart ?? 0;
      const end = clips[i].trimEnd ?? infos[i].duration;
      trimmedDurations.push(Math.max(0.5, end - start));
    }

    const allHaveAudio = infos.every((info) => info.hasAudio);

    // Build filter graph
    const filterParts: string[] = [];

    // Step 1: Trim each clip
    for (let i = 0; i < n; i++) {
      const start = clips[i].trimStart ?? 0;
      const end = clips[i].trimEnd ?? infos[i].duration;
      filterParts.push(`[${i}:v]trim=start=${start.toFixed(3)}:end=${end.toFixed(3)},setpts=PTS-STARTPTS[tv${i}]`);
      if (allHaveAudio) {
        filterParts.push(`[${i}:a]atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[ta${i}]`);
      }
    }

    // Step 2: Video xfade chain on trimmed clips
    let cumulative = 0;
    const xfadeOffsets: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      cumulative += trimmedDurations[i];
      xfadeOffsets.push(Math.max(0, cumulative - xfadeDur * (i + 1)));
    }

    for (let i = 0; i < n - 1; i++) {
      const left = i === 0 ? `[tv0]` : `[xv${i - 1}]`;
      const right = `[tv${i + 1}]`;
      const out = i === n - 2 ? `[vout]` : `[xv${i}]`;
      filterParts.push(
        `${left}${right}xfade=transition=fade:duration=${xfadeDur.toFixed(3)}:offset=${xfadeOffsets[i].toFixed(3)}${out}`,
      );
    }

    // Step 3: Audio crossfade chain (if clips have audio)
    let audioOutLabel = "";
    if (allHaveAudio) {
      for (let i = 0; i < n - 1; i++) {
        const inA = i === 0 ? `[ta0][ta1]` : `[af${i - 1}][ta${i + 1}]`;
        const outA = i === n - 2 ? `[aout]` : `[af${i}]`;
        filterParts.push(`${inA}acrossfade=d=${xfadeDur.toFixed(3)}:c1=tri:c2=tri${outA}`);
      }
      audioOutLabel = "[aout]";
    }

    // Step 4: BGM mixing
    let finalAudioLabel = audioOutLabel;
    if (bgm && bgmPath) {
      const bgmInputIdx = n; // BGM is the last input
      const vol = Math.max(0, Math.min(100, bgm.volume)) / 100;
      if (allHaveAudio) {
        filterParts.push(`[${bgmInputIdx}:a]volume=${vol.toFixed(2)}[bgmvol]`);
        filterParts.push(`[aout][bgmvol]amix=inputs=2:duration=first:dropout_transition=2[afinal]`);
        finalAudioLabel = "[afinal]";
      } else {
        filterParts.push(`[${bgmInputIdx}:a]volume=${vol.toFixed(2)}[afinal]`);
        finalAudioLabel = "[afinal]";
      }
    }

    console.log(`[StitchTrim] Building ffmpeg: ${n} clips, xfade=${xfadeDur}s, bgm=${!!bgm}, audio=${allHaveAudio}`);

    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));
    if (bgmPath) command.input(bgmPath);

    const outputOpts = [
      "-filter_complex", filterParts.join(";"),
      "-map", "[vout]",
      "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-movflags", "+faststart",
    ];

    if (finalAudioLabel) {
      outputOpts.push("-map", finalAudioLabel, "-c:a", "aac", "-b:a", "128k");
    }

    await new Promise<void>((resolve, reject) => {
      command
        .outputOptions(outputOpts)
        .output(outputPath)
        .on("error", (err) => { console.error("[StitchTrim] FFMPEG error:", err); reject(err); })
        .on("end", () => { console.log("[StitchTrim] Processing finished"); resolve(); })
        .run();
    });

    // Upload result
    console.log(`[StitchTrim] Uploading result...`);
    const fileContent = fs.readFileSync(outputPath);

    let blob;
    try {
      blob = await put(`stitched/${outputFileName}`, fileContent, {
        access: "public",
        contentType: "video/mp4",
        addRandomSuffix: false,
      });
    } catch (e: any) {
      if (e.message?.includes("private store")) {
        blob = await put(`stitched/${outputFileName}`, fileContent, {
          access: "private",
          contentType: "video/mp4",
          addRandomSuffix: false,
        });
      } else {
        throw e;
      }
    }

    return blob.url;
  } finally {
    try {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      inputPaths.forEach((p) => { if (fs.existsSync(p)) fs.unlinkSync(p); });
      if (bgmPath && fs.existsSync(bgmPath)) fs.unlinkSync(bgmPath);
    } catch (e) {
      console.error("[StitchTrim] Cleanup error:", e);
    }
  }
}
