import { Suspense } from "react";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import PageviewTracker from "@/components/PageviewTracker";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "zh")) {
    notFound();
  }

  // Must be called before any next-intl server functions (getTranslations, getMessages, etc.)
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <Auth0Provider>{children}</Auth0Provider>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <Analytics />
    </NextIntlClientProvider>
  );
}
