import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth0";
import { analyzeBudget } from "@/lib/campaign-analysis";
import { hasCredits, deductCredits } from "@/lib/credits";
import { trackTokenUsage } from "@/lib/usage-tracking";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return unauthorizedResponse();
  }

  try {
    const hasCreds = await hasCredits(user.id);
    if (!hasCreds) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 }
      );
    }

    const body = await request.json();
    const { name, client, description, budgetCents, startDate, endDate, notes, modelId, locale } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    const result = await analyzeBudget({
      name: name.trim(),
      client: client?.trim() || null,
      description: description?.trim() || null,
      budgetCents: budgetCents || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      notes: notes?.trim() || null,
      materials: [],
      modelId,
      locale,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Budget estimation failed" },
        { status: 500 }
      );
    }

    if (result.usage) {
      await deductCredits({
        userId: user.id,
        usage: result.usage,
        model: result.modelId,
        source: "campaign-budget-estimate",
      });

      await trackTokenUsage({
        userId: user.id,
        source: "campaign-budget-estimate",
        model: result.modelId,
        usage: result.usage,
      });
    }

    return NextResponse.json({
      success: true,
      budget: result.budget,
      modelId: result.modelId,
    });
  } catch (error) {
    console.error("[campaigns/budget-estimate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to estimate budget" },
      { status: 500 }
    );
  }
}
