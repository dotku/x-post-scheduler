import type { Metadata } from "next";
import { getAuthenticatedUser } from "@/lib/auth0";
import LandingContent from "@/components/LandingContent";
import { setRequestLocale } from "next-intl/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
  "https://x-post-scheduler.jytech.us";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isZh = locale === "zh";

  const titleText = isZh
    ? "xPilot — AI 社媒营销副驾驶 | 智能调度·创意生成·自动发布"
    : "xPilot — AI Social Media Marketing Copilot";

  const description = isZh
    ? "AI 驱动的社媒内容调度与自动发布平台。支持文生视频、文生图、知识库驱动创作，Campaign 管理与传媒行业日报，一站式助力品牌增长。"
    : "AI-powered social media scheduling and automation. Featuring AI video generation, image generation, and knowledge-base-driven content creation. Campaign management, media reports, and multi-account publishing — all in one platform.";

  return {
    title: { absolute: titleText },
    description,
    alternates: {
      canonical: isZh ? "/zh" : "/",
      languages: { en: "/", zh: "/zh" },
    },
    openGraph: {
      title: titleText,
      description,
      url: isZh ? "/zh" : "/",
      type: "website",
      siteName: "xPilot",
      locale: isZh ? "zh_CN" : "en_US",
      images: [
        {
          url: "/api/og",
          width: 1200,
          height: 630,
          alt: titleText,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titleText,
      description,
      images: ["/api/og"],
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getAuthenticatedUser();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "xPilot",
        url: SITE_URL,
        logo: `${SITE_URL}/api/og`,
      },
      {
        "@type": "WebApplication",
        name: "xPilot",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "AI-powered social media scheduling, content creation, and marketing automation platform with AI video and image generation.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingContent isLoggedIn={!!user} />
    </>
  );
}
