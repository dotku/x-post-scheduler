import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    "https://x-post-scheduler.jytech.us";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/admin",
          "/settings",
          "/generate",
          "/recurring",
          "/schedule",
          "/analytics",
          "/zh/dashboard",
          "/zh/admin",
          "/zh/settings",
          "/zh/generate",
          "/zh/recurring",
          "/zh/schedule",
          "/zh/analytics",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
