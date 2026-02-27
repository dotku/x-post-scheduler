import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mainstream Media Channels in the U.S. (2026) | xPilot",
  description:
    "Overview of mainstream media channels in the United States across TV, newspapers, digital-native, audio, and social platforms.",
};

export default async function USMainstreamMediaCaseStudyPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "zh" ? "/zh" : "";
  redirect(`${prefix}/media-news/us-mainstream-media-2026`);
}
