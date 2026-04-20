/**
 * Publish all jewelry-ad demo videos to the xPilot Gallery as public items.
 *
 * Reads existing R2 URLs from the various phases, calls saveToGallery for
 * each one, and prints the resulting gallery item IDs + URLs.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/publish-jewelry-gallery.ts
 *
 * Idempotent-ish: it always creates new items (doesn't dedupe). Re-run only
 * if you want fresh entries.
 */
import { saveToGallery } from "../lib/gallery";

// Jay Lin (jytech202307@gmail.com) — first user, treat as the publisher
const PUBLISHER_USER_ID = "cmlr301800000js04eqjowpal";

type PublishItem = {
  label: string;
  type: "image" | "video";
  modelId: string;
  modelLabel: string;
  prompt: string;
  sourceUrl: string;
  aspectRatio: string;
  generationMeta?: Record<string, unknown>;
};

const ITEMS: PublishItem[] = [
  // ── Phase A: ffmpeg-polished version of original 10s ─────────────────────
  {
    label: "Path A — ffmpeg polished (1:1)",
    type: "video",
    modelId: "ffmpeg/post-production",
    modelLabel: "ffmpeg post-production",
    prompt:
      "Post-production polish of an emerald cushion-cut diamond halo ring " +
      "rotation video. AI watermark cropped, 12fps→30fps motion-interpolated, " +
      "720p upscaled to 1080×1080, color-graded for jewelry sparkle, " +
      "forward+reverse loop to 20s, brand text overlays added, ambient " +
      "C-major triad pad as BGM. Pure ffmpeg post-production, no AI " +
      "regeneration. Cost: $0.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/polished/jewelry-ad-polished.mp4",
    aspectRatio: "1:1",
    generationMeta: { phase: "A", cost_usd: 0, duration_s: 20, resolution: "1080x1080" },
  },

  // ── 4-way comparison clips (each is its own gallery item) ────────────────
  {
    label: "Cmp — Vidu Q3 Pro (img2video, 1:1)",
    type: "video",
    modelId: "viduq3-pro",
    modelLabel: "Vidu Q3 Pro img2video",
    prompt:
      "An elegant emerald cushion-cut diamond halo ring rotates slowly, " +
      "shimmering green silk and metallic waves flow gently in the background, " +
      "sparkles and light rays drift across the scene, cinematic 3D jewelry " +
      "visualization, brilliant reflections, slow motion, 4K. " +
      "Generated with Vidu Q3 Pro img2video starting from a polished " +
      "first-frame reference image.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/comparison/vidu-q3-pro.mp4",
    aspectRatio: "1:1",
    generationMeta: { phase: "comparison", provider: "Vidu", credits: 125, cost_usd: 1.25 },
  },
  {
    label: "Cmp — BytePluses Seedance 1.5 Pro (i2v, 1:1)",
    type: "video",
    modelId: "bytedance/seedance-v1.5-pro/image-to-video",
    modelLabel: "Seedance 1.5 Pro (BytePluses route)",
    prompt:
      "Same emerald cushion-cut diamond halo ring reference image, generated " +
      "via Seedance 1.5 Pro through BytePluses enterprise endpoint. " +
      "Cinematic jewelry visualization, slow motion, brilliant reflections.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/comparison/bytepluses-seedance.mp4",
    aspectRatio: "1:1",
    generationMeta: { phase: "comparison", provider: "BytePluses", cost_usd: 0.4, duration_to_complete_s: 103 },
  },
  {
    label: "Cmp — Wavespeed Seedance 1.5 Pro (i2v, 1:1)",
    type: "video",
    modelId: "bytedance/seedance-v1.5-pro/image-to-video",
    modelLabel: "Seedance 1.5 Pro (Wavespeed route)",
    prompt:
      "Same emerald cushion-cut diamond halo ring reference image, generated " +
      "via Seedance 1.5 Pro through Wavespeed gateway. Demonstrates that " +
      "Wavespeed routes the same model 41% faster than direct BytePluses " +
      "(61s vs 103s) at the same price.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/comparison/wavespeed-seedance.mp4",
    aspectRatio: "1:1",
    generationMeta: { phase: "comparison", provider: "Wavespeed", cost_usd: 0.4, duration_to_complete_s: 61 },
  },
  {
    label: "Cmp — Wavespeed Wan 2.2 i2v 720p (1:1)",
    type: "video",
    modelId: "wavespeed-ai/wan-2.2/i2v-720p",
    modelLabel: "Wan 2.2 i2v 720p",
    prompt:
      "Same emerald cushion-cut diamond halo ring reference image, generated " +
      "with Alibaba Wan 2.2 i2v 720p model. Different visual treatment from " +
      "the Seedance versions — more dramatic god-rays and lighting.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/comparison/wavespeed-wan22.mp4",
    aspectRatio: "1:1",
    generationMeta: { phase: "comparison", provider: "Wavespeed", model_family: "Alibaba Wan", cost_usd: 0.25 },
  },

  // ── Phase 1 prompt validation (9:16 vertical, ARRI prompt) ────────────────
  {
    label: "P1 — Kling O3 Std t2v (9:16, ARRI prompt)",
    type: "video",
    modelId: "kwaivgi/kling-video-o3-std/text-to-video",
    modelLabel: "Kling O3 Std",
    prompt:
      "Studio jewelry photography commercial. Emerald cushion-cut diamond " +
      "halo ring on platinum band, single dramatic key light from above-left, " +
      "deep black reflective acrylic surface, extreme shallow depth of field, " +
      "100mm macro lens, controlled deliberate rotation, ARRI Alexa LF " +
      "aesthetic, ProRes 4444 grade, 8K. Kling O3 Std at 9:16 vertical " +
      "produced cleanest product photography look in 46 seconds.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase1/kling-o3-std.mp4",
    aspectRatio: "9:16",
    generationMeta: { phase: "1", provider: "Wavespeed/Kling", duration_to_complete_s: 46, cost_usd: 0.5 },
  },
  {
    label: "P1 — Seedance 1.5 Pro t2v (9:16, bokeh + lens flare)",
    type: "video",
    modelId: "bytedance/seedance-v1.5-pro/text-to-video",
    modelLabel: "Seedance 1.5 Pro t2v",
    prompt:
      "Same ARRI-Alexa-level jewelry prompt as the Kling test. Seedance 1.5 " +
      "Pro added unprompted anamorphic lens flares and creamy bokeh particles, " +
      "matching JmodelsJewelry's signature atmospheric look.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase1/seedance-15-pro.mp4",
    aspectRatio: "9:16",
    generationMeta: { phase: "1", provider: "Wavespeed/Seedance", duration_to_complete_s: 76, cost_usd: 0.4 },
  },
  {
    label: "P1 — Vidu Q3 Pro t2v (9:16, starburst king)",
    type: "video",
    modelId: "viduq3-pro",
    modelLabel: "Vidu Q3 Pro t2v",
    prompt:
      "Same ARRI prompt — Vidu Q3 Pro is the starburst king. Each diamond " +
      "facet erupted with intense light spikes and rose-gold warm color " +
      "grading. Best for the 'bling bling' shot.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase1/vidu-q3-pro.mp4",
    aspectRatio: "9:16",
    generationMeta: { phase: "1", provider: "Vidu", credits: 125, duration_to_complete_s: 159, cost_usd: 1.25 },
  },

  // ── Phase 2: 22s mixed-model multi-shot ──────────────────────────────────
  {
    label: "Phase 2 — Mixed-model 22s ad (Vidu+Seedance+Kling+Vidu)",
    type: "video",
    modelId: "multi/vidu+seedance+kling",
    modelLabel: "Mixed: Vidu Q3 Pro + Seedance 1.5 Pro + Kling O3 Std",
    prompt:
      "22-second JmodelsJewelry-style ad assembled from 4 distinct shots: " +
      "Hero Reveal (Vidu Q3 Pro starburst), Atmosphere (Seedance bokeh + " +
      "lens flare), Detail (Kling O3 Std clean rotation), Finale (Vidu Q3 " +
      "Pro volumetric light beams). Vertical 9:16 720x1280 30fps, ffmpeg " +
      "concatenation, Replicate musicgen cinematic BGM (stereo-melody-large, " +
      "80 BPM piano + glass chimes). Total cost: $3.45. Total time: 3m 45s.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase2/jewelry-jmodels-style-v3.mp4",
    aspectRatio: "9:16",
    generationMeta: {
      phase: "2",
      cost_usd: 3.45,
      duration_to_complete_s: 225,
      providers: ["Vidu Q3 Pro", "Seedance 1.5 Pro", "Kling O3 Std", "Replicate musicgen"],
      shots: 4,
      total_duration_s: 22,
    },
  },

  // ── Phase 4: 12s single-take (current best) ──────────────────────────────
  {
    label: "Phase 4 — Single-take 12s (current best)",
    type: "video",
    modelId: "viduq3-pro+dreamina",
    modelLabel: "Dreamina 3.1 → Vidu Q3 Pro img2video → musicgen",
    prompt:
      "Insight-driven rebuild after analyzing JmodelsJewelry's actual TikTok " +
      "videos: 4 out of 6 use ZERO scene cuts. So this version is ONE 10-second " +
      "continuous Vidu Q3 Pro img2video shot (slow dolly back + clockwise " +
      "rotation) starting from a Dreamina 3.1 master reference image of the " +
      "exact ring. Same ring throughout, no style drift between shots. Plus " +
      "a 2s brand title card with cross-fade. 9:16 720x1280 30fps, " +
      "Replicate musicgen ambient BGM. Total cost: $2.55. Total time: 4m 46s.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase4/jewelry-jmodels-style-v4.mp4",
    aspectRatio: "9:16",
    generationMeta: {
      phase: "4",
      cost_usd: 2.55,
      duration_to_complete_s: 286,
      providers: ["Wavespeed Dreamina 3.1", "Vidu Q3 Pro img2video", "Replicate musicgen"],
      shots: 1,
      total_duration_s: 12,
      note: "Current best version. Single-take matches JModels actual structure.",
    },
  },
  // Phase 4 supporting asset — the master reference image (good standalone)
  {
    label: "Phase 4 — Master reference image (Dreamina 3.1)",
    type: "image",
    modelId: "bytedance/dreamina-v3.1/text-to-image",
    modelLabel: "Dreamina 3.1",
    prompt:
      "Ultra-photorealistic luxury jewelry product shot. Magnificent emerald " +
      "cushion-cut diamond halo ring on platinum split-shank band, 5 carat " +
      "deep saturated green emerald, halo of 16 round brilliant diamonds, " +
      "tiny pavé diamonds along band. Black polished acrylic surface, " +
      "single dramatic key light from above-left at 45°, chiaroscuro " +
      "lighting, ARRI Alexa LF aesthetic, 8K commercial quality, " +
      "vertical 9:16. Used as the master reference for the Phase 4 Vidu " +
      "img2video shot.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase4/master-reference.png",
    aspectRatio: "9:16",
    generationMeta: { phase: "4", role: "reference", cost_usd: 0.04 },
  },
];

async function main() {
  console.log("=== Publishing Jewelry Demo Suite to xPilot Gallery ===\n");
  console.log(`Publisher userId: ${PUBLISHER_USER_ID}`);
  console.log(`Items to publish: ${ITEMS.length}\n`);

  const results: { label: string; itemId?: string; error?: string }[] = [];

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    process.stdout.write(`[${i + 1}/${ITEMS.length}] ${item.label}... `);
    try {
      const created = await saveToGallery({
        userId: PUBLISHER_USER_ID,
        type: item.type,
        modelId: item.modelId,
        modelLabel: item.modelLabel,
        prompt: item.prompt,
        sourceUrl: item.sourceUrl,
        aspectRatio: item.aspectRatio,
        generationMeta: item.generationMeta,
        isPublic: true,
      });
      console.log(`✓ ${created.id}`);
      results.push({ label: item.label, itemId: created.id });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.log(`✗ ${error}`);
      results.push({ label: item.label, error });
    }
  }

  // Summary
  const ok = results.filter((r) => r.itemId);
  const failed = results.filter((r) => r.error);

  console.log("\n========================================");
  console.log(`✓ Published ${ok.length}/${results.length} items`);
  console.log("========================================");

  if (ok.length > 0) {
    console.log("\nSuccessful items (visit /media-studio/gallery to see them):");
    for (const r of ok) {
      console.log(`  ${r.itemId}  ${r.label}`);
    }
  }
  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const r of failed) {
      console.log(`  ✗ ${r.label}: ${r.error}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nFatal:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
