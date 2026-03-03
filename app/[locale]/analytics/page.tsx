import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth0";
import { redirect } from "next/navigation";
import { getTranslations, getLocale, setRequestLocale } from "next-intl/server";
import UserMenu from "@/components/UserMenu";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import dynamic from "next/dynamic";
const AnalyticsContent = dynamic(() => import("@/components/AnalyticsContent"), { ssr: false });

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  setRequestLocale(localeParam);

  const t = await getTranslations("analytics");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(locale === "zh" ? "/zh/login" : "/login");
  }

  // Redirect to user's preferred locale if different from current URL locale
  const preferredLocale = user.language || "en";
  if (preferredLocale !== locale) {
    redirect(preferredLocale === "zh" ? "/zh/analytics" : "/analytics");
  }

  // Fetch user's X accounts
  const accounts = await prisma.xAccount.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      username: true,
      isDefault: true,
    },
    orderBy: { isDefault: "desc" },
  });

  const prefix = locale === "zh" ? "/zh" : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              <Link
                href={prefix || "/"}
                className="hover:opacity-80 transition-opacity"
              >
                {tNav("appTitle")}
              </Link>
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href={`${prefix}/dashboard`}
                className="text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 flex items-center gap-1"
              >
               {t("backToDashboard")}
              </Link>
              <div className="border-l border-gray-300 dark:border-gray-600 h-5 mx-1 hidden sm:block" />
              <LanguageSwitcher />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnalyticsContent accounts={accounts} />
      </main>
    </div>
  );
}
