import { getAuthenticatedUser } from "@/lib/auth0";
import { redirect } from "next/navigation";
import LandingContent from "@/components/LandingContent";
import { getLocale } from "next-intl/server";

export default async function LandingPage() {
  const user = await getAuthenticatedUser();
  const locale = await getLocale();
  if (user) {
    redirect(locale === "zh" ? "/zh/dashboard" : "/dashboard");
  }

  return <LandingContent />;
}
