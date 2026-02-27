import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mainstream Social Media Landscape (2026) | xPilot",
  description:
    "A data-backed case study of mainstream social media channels using the latest available 2025-2026 public data.",
};

export default async function SocialMediaCaseStudyPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "zh" ? "/zh" : "";
  redirect(`${prefix}/media-news/social-media-landscape-2026`);
}
