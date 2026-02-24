import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { getUserXCredentials } from "@/lib/user-credentials";
import { generateTweet } from "@/lib/openai";
import { trackTokenUsage, trackWavespeedUsage } from "@/lib/usage-tracking";
import {
  hasCredits,
  deductCredits,
  getCreditBalance,
  getWavespeedFeeCents,
  deductWavespeedCredits,
} from "@/lib/credits";
import { decodeRecurringAiPrompt } from "@/lib/recurring-ai";
import { buildTrendPrompt } from "@/lib/trending";
import { submitImageTask } from "@/lib/wavespeed";
import { waitForImageOutput } from "@/lib/scheduler";
import { isVerifiedMember } from "@/lib/subscription";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  const membership = await prisma.user.findUnique({
    where: { id: user.id },
    select: { subscriptionTier: true, subscriptionStatus: true },
  });
  if (
    !isVerifiedMember(
      membership?.subscriptionTier,
      membership?.subscriptionStatus,
    )
  ) {
    await prisma.recurringSchedule.updateMany({
      where: { userId: user.id, isActive: true },
      data: { isActive: false },
    });
    return NextResponse.json({ error: "MEMBERSHIP_REQUIRED" }, { status: 403 });
  }

  const { id } = await params;

  // 可选：客户端传入指定新闻话题，覆盖 schedule.trendRegion 自动抓取
  let bodyTrendName: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.trendName === "string" && body.trendName.trim()) {
      bodyTrendName = body.trendName.trim();
    }
  } catch {
    // body 为空也正常
  }

  const schedule = await prisma.recurringSchedule.findFirst({
    where: { id, userId: user.id },
  });

  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const resolved = await getUserXCredentials(user.id, schedule.xAccountId);
  if (!resolved) {
    return NextResponse.json(
      { error: "X API credentials not configured for this schedule account." },
      { status: 400 },
    );
  }

  if (schedule.useAi && !(await hasCredits(user.id))) {
    return NextResponse.json(
      {
        error:
          "Insufficient credits. Please add credits in Settings to continue using AI generation.",
      },
      { status: 402 },
    );
  }

  const decodedAiPrompt = decodeRecurringAiPrompt(schedule.aiPrompt);
  const imageModelId = decodedAiPrompt.imageModelId;

  if (!schedule.useAi) {
    return NextResponse.json({
      success: true,
      mode: "fixed",
      content: schedule.content,
    });
  }

  const sources = await prisma.knowledgeSource.findMany({
    where: { isActive: true, userId: user.id },
  });

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No knowledge sources found for AI schedule test." },
      { status: 400 },
    );
  }

  const knowledgeContext = sources
    .map((source) => {
      const truncatedContent =
        source.content.length > 2000
          ? source.content.substring(0, 2000) + "..."
          : source.content;
      return `Source: ${source.name} (${source.url})\n${truncatedContent}`;
    })
    .join("\n\n---\n\n");

  // 注入热点方向：优先使用客户端传入的指定话题，否则按 trendRegion 自动抓取
  let effectivePrompt = decodedAiPrompt.prompt || undefined;
  if (bodyTrendName) {
    const trendContext = `Today's trending news: "${bodyTrendName}". Connect this topic naturally to my business context and create an engaging post.`;
    effectivePrompt = decodedAiPrompt.prompt
      ? `${trendContext} Additional direction: ${decodedAiPrompt.prompt}`
      : trendContext;
  } else if (schedule.trendRegion) {
    try {
      effectivePrompt = await buildTrendPrompt(
        user.id,
        schedule.trendRegion,
        decodedAiPrompt.prompt,
      );
    } catch (trendErr) {
      console.warn(
        "Failed to fetch trends for test, using base prompt:",
        trendErr,
      );
    }
  }

  const generated = await generateTweet(
    knowledgeContext,
    effectivePrompt,
    schedule.aiLanguage || undefined,
  );

  if (generated.usage) {
    try {
      await trackTokenUsage({
        userId: user.id,
        source: "recurring_item_test",
        usage: generated.usage,
        model: generated.model,
        metadata: { scheduleId: schedule.id },
      });
      await deductCredits({
        userId: user.id,
        usage: generated.usage,
        model: generated.model,
        source: "recurring_item_test",
      });
    } catch (error) {
      console.error("Failed to track/deduct recurring item test usage:", error);
    }
  }

  if (!generated.success || !generated.content) {
    return NextResponse.json(
      { error: generated.error || "Failed to generate sample content." },
      { status: 500 },
    );
  }

  const responseContent = generated.content!;

  // Generate image if an image model is configured
  if (imageModelId) {
    try {
      const imageFeeCents = getWavespeedFeeCents(imageModelId, "image");
      const balance = await getCreditBalance(user.id);
      if (balance < imageFeeCents) {
        return NextResponse.json({
          success: true,
          mode: "ai",
          content: responseContent,
          imageError: `Insufficient credits for image generation (need $${(imageFeeCents / 100).toFixed(2)})`,
        });
      }

      const task = await submitImageTask({
        modelId: imageModelId,
        prompt: responseContent,
        aspectRatio: "16:9",
      });
      const pollKey = task.outputs?.[0] ? task.id : task.urls?.get || task.id;
      const settled = task.outputs?.[0]
        ? { outputUrl: task.outputs[0], taskId: task.id }
        : await waitForImageOutput(pollKey);

      try {
        await deductWavespeedCredits({
          userId: user.id,
          modelId: imageModelId,
          mediaType: "image",
          source: "recurring_item_test_image",
          taskId: settled.taskId,
        });
        await trackWavespeedUsage({
          userId: user.id,
          source: "recurring_item_test_image",
          model: imageModelId,
          prompt: responseContent,
          metadata: { scheduleId: schedule.id, taskId: settled.taskId },
        });
      } catch (usageErr) {
        console.error("Failed to track/deduct test image usage:", usageErr);
      }

      return NextResponse.json({
        success: true,
        mode: "ai",
        content: responseContent,
        imageUrl: settled.outputUrl,
      });
    } catch (imgErr) {
      return NextResponse.json({
        success: true,
        mode: "ai",
        content: responseContent,
        imageError:
          imgErr instanceof Error ? imgErr.message : "Image generation failed",
      });
    }
  }

  return NextResponse.json({
    success: true,
    mode: "ai",
    content: responseContent,
  });
}
