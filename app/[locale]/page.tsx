import { getAuthenticatedUser } from "@/lib/auth0";
import { redirect } from "next/navigation";
import LandingContent from "@/components/LandingContent";
import { setRequestLocale } from "next-intl/server";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getAuthenticatedUser();
  if (user) {
    const preferredLocale = user.language || "en";
    redirect(preferredLocale === "zh" ? "/zh/dashboard" : "/dashboard");
  }

  return <LandingContent />;
}
