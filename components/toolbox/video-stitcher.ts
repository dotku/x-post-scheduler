/** Extracts the last frame of a video URL as a JPEG Blob (client-side, via canvas). */
export async function extractLastFrame(proxyUrl: string): Promise<Blob> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
  document.body.appendChild(video);
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error("Failed to load video for frame extraction")),
        { once: true },
      );
      video.src = proxyUrl;
      video.load();
    });
    video.currentTime = Math.max(0, video.duration - 0.1);
    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.92,
      );
    });
  } finally {
    document.body.removeChild(video);
  }
}

/** Core stitch logic: plays proxy URLs sequentially through a hidden video and records to WebM. */
export async function stitchProxyUrls(
  proxyUrls: string[],
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = true;
  video.style.cssText =
    "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px";
  document.body.appendChild(video);

  try {
    const captureVideo = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };

    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), {
        once: true,
      });
      video.addEventListener(
        "error",
        () => reject(new Error("Failed to load first segment")),
        { once: true },
      );
      video.src = proxyUrls[0];
      video.load();
    });

    const stream =
      typeof captureVideo.captureStream === "function"
        ? captureVideo.captureStream()
        : captureVideo.mozCaptureStream?.();
    if (!stream)
      throw new Error("captureStream is not supported (Chrome required).");

    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType =
      candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
    if (!mimeType)
      throw new Error("MediaRecorder webm not supported in this browser.");

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const waitForEnd = () =>
      new Promise<void>((resolve, reject) => {
        video.addEventListener("ended", () => resolve(), { once: true });
        video.addEventListener(
          "error",
          () => reject(new Error("Failed while playing segment")),
          { once: true },
        );
      });

    recorder.start(100);
    for (let i = 0; i < proxyUrls.length; i++) {
      if (i > 0) {
        video.src = proxyUrls[i];
        video.load();
        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
          video.addEventListener(
            "error",
            () => reject(new Error(`Failed to load segment ${i + 1}`)),
            { once: true },
          );
        });
      }
      const endPromise = waitForEnd();
      await video.play();
      await endPromise;
      onProgress?.(i + 1, proxyUrls.length);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener("stop", () => {
        if (chunks.length === 0) {
          reject(new Error("No recorded data generated."));
          return;
        }
        resolve(new Blob(chunks, { type: mimeType }));
      });
      recorder.addEventListener("error", () =>
        reject(new Error("Recorder error")),
      );
      recorder.stop();
    });

    return URL.createObjectURL(blob);
  } finally {
    document.body.removeChild(video);
  }
}
