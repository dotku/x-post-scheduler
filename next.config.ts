import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/news", destination: "/media-news", permanent: false },
      { source: "/news/:path*", destination: "/media-news/:path*", permanent: false },
      { source: "/zh/news", destination: "/zh/media-news", permanent: false },
      { source: "/zh/news/:path*", destination: "/zh/media-news/:path*", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
