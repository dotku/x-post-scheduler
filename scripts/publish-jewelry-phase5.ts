/**
 * Publish Phase 5 (Cartier-style snowy white-sparkle version) to xPilot Gallery.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/publish-jewelry-phase5.ts
 */
import { saveToGallery } from "../lib/gallery";

const PUBLISHER_USER_ID = "cmlr301800000js04eqjowpal"; // Jay Lin

const ITEMS = [
  {
    label: "Phase 5 — Cartier snowy white-sparkle (NEW current best)",
    type: "video" as const,
    modelId: "viduq3-pro+dreamina+musicgen",
    modelLabel: "Dreamina 3.1 → Vidu Q3 Pro img2video → musicgen (Cartier aesthetic)",
    prompt:
      "Phase 5 rebuilds the prompt around CLEAN WHITE pinpoint sparkles " +
      "(no rainbow, no chromatic aberration), an airy snowy mountain " +
      "environment with soft bokeh background, high-key bright lighting, " +
      "and Cartier Panthère commercial aesthetic. Single 10-second " +
      "continuous Vidu Q3 Pro img2video shot starting from a Dreamina 3.1 " +
      "master reference of the exact ring sitting on snow with snowy peaks " +
      "behind it. Slow controlled clockwise camera orbit. Plus 2s brand " +
      "title card with cross-fade. 9:16 720x1280, Replicate musicgen " +
      "ambient piano + glass chimes BGM. Total cost: $2.59. Total time: 5m 6s. " +
      "This version directly answers the previous feedback that v3/v4 had " +
      "too much rainbow starburst and missing environmental atmosphere.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase5/jewelry-jmodels-style-v5.mp4",
    aspectRatio: "9:16",
    generationMeta: {
      phase: "5",
      cost_usd: 2.59,
      duration_to_complete_s: 306,
      providers: ["Wavespeed Dreamina 3.1", "Vidu Q3 Pro img2video", "Replicate musicgen"],
      shots: 1,
      total_duration_s: 12,
      style_reference: "Cartier Panthère commercial aesthetic",
      sparkle_color: "monochromatic white (no rainbow)",
      background: "snowy mountain bokeh",
      lighting: "high-key bright daylight",
      note: "Current best version. Directly addresses the rainbow / black-void feedback from v3/v4.",
    },
  },
  {
    label: "Phase 5 — Master reference image (snowy Cartier aesthetic)",
    type: "image" as const,
    modelId: "bytedance/dreamina-v3.1/text-to-image",
    modelLabel: "Dreamina 3.1",
    prompt:
      "Master reference image used as the starting frame for the Phase 5 " +
      "Vidu img2video shot. An emerald cushion-cut diamond halo ring on a " +
      "platinum split-shank band, sitting on fresh white snow with soft " +
      "out-of-focus snowy mountain peaks in the deep background. Bright " +
      "high-key daylight, airy ethereal mood, gentle bokeh light particles, " +
      "Cartier Panthère brand commercial aesthetic. Pure white pinpoint " +
      "diamond sparkles only — no rainbow, no chromatic aberration. " +
      "Hyper-realistic Octane render aesthetic, raytraced lighting, ARRI " +
      "Alexa LF + Atlas Orion anamorphic prime lens look. Vertical 9:16.",
    sourceUrl:
      "https://pub-22e3d3e3f43e400493bbd71306cae6bb.r2.dev/demo/jewelry-ad/phase5/master-reference.png",
    aspectRatio: "9:16",
    generationMeta: { phase: "5", role: "reference", cost_usd: 0.04 },
  },
];

async function main() {
  console.log(`Publishing ${ITEMS.length} Phase 5 items to gallery...\n`);
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    process.stdout.write(`[${i + 1}/${ITEMS.length}] ${item.label}... `);
    try {
      const created = await saveToGallery({
        userId: PUBLISHER_USER_ID,
        ...item,
        isPublic: true,
      });
      console.log(`✓ ${created.id}`);
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("\n✓ Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fatal:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
