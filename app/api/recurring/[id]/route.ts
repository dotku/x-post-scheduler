import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.recurringSchedule.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  try {
    const schedule = await prisma.recurringSchedule.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(schedule);
  } catch {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }
}
