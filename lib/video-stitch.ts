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

    // Probe for audio presence (needed to decide whether to apply acrossfade)
    const infos = await Promise.all(inputPaths.map(getVideoInfo));
    const n = inputPaths.length;
    const allHaveAudio = infos.every((info) => info.hasAudio);

    console.log(`[Stitch] Combining ${n} videos, audio=${allHaveAudio}...`);
    const command = ffmpeg();
    inputPaths.forEach((p) => command.input(p));

    await new Promise<void>((resolve, reject) => {
      if (allHaveAudio) {
        // Use filter_complex to add a 20ms audio crossfade at each splice point.
        // This eliminates the DC-offset pop/click without any audible transition effect.
        // Video is also concatenated through the filter (re-encoded at high quality).
        const AUDIO_FADE = 0.02; // 20ms — invisible crossfade, just removes the click
        const filterParts: string[] = [];

        // Video concat
        const vInputs = inputPaths.map((_, i) => `[${i}:v]`).join("");
        filterParts.push(`${vInputs}concat=n=${n}:v=1:a=0[v]`);

        // Audio acrossfade chain
        for (let i = 0; i < n - 1; i++) {
          const inA = i === 0 ? `[0:a][1:a]` : `[af${i - 1}][${i + 1}:a]`;
          filterParts.push(`${inA}acrossfade=d=${AUDIO_FADE}:c1=tri:c2=tri[af${i}]`);
        }
        const finalAudio = `af${n - 2}`;

        command
          .outputOptions([
            "-filter_complex", filterParts.join(";"),
            "-map", "[v]",
            "-map", `[${finalAudio}]`,
            "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "128k",
          ])
          .output(outputPath)
          .on("error", (err) => { console.error("[Stitch] FFMPEG error:", err); reject(err); })
          .on("end", () => { console.log("[Stitch] Processing finished successfully"); resolve(); })
          .run();
      } else {
        // No audio — simple concat is fine, no click risk
        command
          .on("error", (err) => { console.error("[Stitch] FFMPEG error:", err); reject(err); })
          .on("end", () => { console.log("[Stitch] Processing finished successfully"); resolve(); })
          .mergeToFile(outputPath, tempDir);
      }
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
