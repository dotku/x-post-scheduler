import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    "https://x-post-scheduler.jytech.us";

  const staticPages = [
    "",
    "/about",
    "/news",
    "/gallery",
    "/changelog",
    "/terms",
    "/privacy",
    "/disclaimer",
    "/invest",
    "/toolbox",
    "/login",
    "/campaigns",
    "/docs",
    "/case-study",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const page of staticPages) {
    const isHome = page === "";
    entries.push(
      {
        url: `${baseUrl}${page}`,
        lastModified: new Date(),
        changeFrequency: isHome ? "daily" : "weekly",
        priority: isHome ? 1.0 : 0.7,
      },
      {
        url: `${baseUrl}/zh${page}`,
        lastModified: new Date(),
        changeFrequency: isHome ? "daily" : "weekly",
        priority: isHome ? 0.9 : 0.6,
      },
    );
  }

  // Dynamic: news report dates
  try {
    const reports = await prisma.mediaIndustryReport.findMany({
      where: { period: "daily" },
      select: { reportDate: true, updatedAt: true },
      orderBy: { reportDate: "desc" },
      take: 60,
    });

    for (const r of reports) {
      const dateStr = r.reportDate.toISOString().slice(0, 10);
      entries.push(
        {
          url: `${baseUrl}/news/${dateStr}`,
          lastModified: r.updatedAt,
          changeFrequency: "daily",
          priority: 0.6,
        },
        {
          url: `${baseUrl}/zh/news/${dateStr}`,
          lastModified: r.updatedAt,
          changeFrequency: "daily",
          priority: 0.5,
        },
      );
    }
  } catch {
    // DB unavailable at build time — skip dynamic entries
  }

  return entries;
}
