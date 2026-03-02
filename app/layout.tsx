import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
      "https://x-post-scheduler.jytech.us",
  ),
  title: {
    default: "xPilot — AI Social Media Marketing Copilot",
    template: "%s | xPilot",
  },
  description:
    "AI-powered social media scheduling, content creation, and marketing automation. Generate images, videos, and posts — publish to X on autopilot.",
  openGraph: {
    type: "website",
    siteName: "xPilot",
    locale: "en_US",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "xPilot — AI Social Media Marketing Copilot",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/api/og"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
