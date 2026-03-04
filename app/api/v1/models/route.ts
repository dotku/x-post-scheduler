import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, apiError } from "@/lib/api-auth";
import { VIDEO_MODELS, I2V_MODELS, IMAGE_MODELS } from "@/lib/wavespeed";
import { SEEDANCE_VIDEO_MODELS, SEEDANCE_I2V_MODELS } from "@/lib/seedance";
import { TEXT_MODELS } from "@/lib/ai-models";
import { getWavespeedFeeCents } from "@/lib/credits";

/** GET /api/v1/models — list available models with pricing */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth(request.headers.get("authorization"));
  if (auth instanceof NextResponse) return auth;

  const text = TEXT_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    description: m.description,
    type: "text",
  }));

  const video = [
    ...VIDEO_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      tier: m.tier,
      supports_audio: m.supportsAudio ?? false,
      supports_lock_camera: false,
      durations: "durations" in m ? (m as Record<string, unknown>).durations : undefined,
      cost_cents_per_5s: getWavespeedFeeCents(m.id, "video"),
      type: "video" as const,
      mode: "text-to-video" as const,
      provider: "wavespeed" as const,
    })),
    ...SEEDANCE_VIDEO_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      tier: m.tier,
      supports_audio: m.supportsAudio ?? false,
      supports_lock_camera: true,
      durations: m.durations,
      cost_cents_per_5s: getWavespeedFeeCents(m.id, "video"),
      type: "video" as const,
      mode: "text-to-video" as const,
      provider: "seedance" as const,
    })),
  ];

  const i2v = [
    ...I2V_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      tier: m.tier,
      supports_audio: m.supportsAudio ?? false,
      supports_lock_camera: false,
      durations: "durations" in m ? (m as Record<string, unknown>).durations : undefined,
      cost_cents_per_5s: getWavespeedFeeCents(m.id, "video"),
      type: "video" as const,
      mode: "image-to-video" as const,
      provider: "wavespeed" as const,
    })),
    ...SEEDANCE_I2V_MODELS.map((m) => ({
      id: m.id,
      label: m.label,
      tier: m.tier,
      supports_audio: m.supportsAudio ?? false,
      supports_lock_camera: true,
      durations: m.durations,
      cost_cents_per_5s: getWavespeedFeeCents(m.id, "video"),
      type: "video" as const,
      mode: "image-to-video" as const,
      provider: "seedance" as const,
    })),
  ];

  const image = IMAGE_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    tier: m.tier,
    cost_cents: getWavespeedFeeCents(m.id, "image"),
    type: "image",
  }));

  return NextResponse.json({
    models: { text, video: [...video, ...i2v], image },
  });
}
