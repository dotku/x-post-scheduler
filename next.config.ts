import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/media-news", destination: "/news", permanent: true },
      { source: "/media-news/:path*", destination: "/news/:path*", permanent: true },
      { source: "/zh/media-news", destination: "/zh/news", permanent: true },
      { source: "/zh/media-news/:path*", destination: "/zh/news/:path*", permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
