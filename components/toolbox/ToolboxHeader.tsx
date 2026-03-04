import Link from "next/link";
import UserMenu from "@/components/UserMenu";

interface ToolboxHeaderProps {
  uiText: Record<string, string>;
  prefix: string;
  locale: string;
  creditLoading: boolean;
  creditBalance: number | null;
  isTrial: boolean;
}

export default function ToolboxHeader({
  uiText,
  prefix,
  locale,
  creditLoading,
  creditBalance,
  isTrial,
}: ToolboxHeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {uiText.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {uiText.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <Link
                href={`${prefix}/gallery`}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {uiText.galleryFeed}
              </Link>
              <Link
                href={`${prefix}/toolbox/video-jobs`}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {uiText.videoJobs}
              </Link>
              {uiText.videoStitch && (
                <Link
                  href={`${prefix}/toolbox/video-stitch`}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  {uiText.videoStitch}
                </Link>
              )}
              <Link
                href={`${prefix}/docs/models`}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {uiText.modelDocs}
              </Link>
              <Link
                href={`${prefix}/dashboard`}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {uiText.dashboardHome}
              </Link>
            </div>
            {creditLoading ? (
              <span className="text-xs text-gray-400">
                {uiText.loadingBalance}
              </span>
            ) : creditBalance !== null ? (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isTrial ? "bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" : "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800"}`}
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isTrial
                    ? locale === "zh"
                      ? "试用余额"
                      : "Trial"
                    : locale === "zh"
                      ? "余额"
                      : "Balance"}
                </span>
                <span
                  className={`text-sm font-bold ${isTrial ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}
                >
                  ${(creditBalance / 100).toFixed(2)}
                </span>
                {isTrial ? (
                  <Link
                    href={`${prefix}/login`}
                    className="text-xs px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    {locale === "zh" ? "注册" : "Sign up"}
                  </Link>
                ) : (
                  <Link
                    href={`${prefix}/settings?tab=billing`}
                    className="text-xs px-2 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
                  >
                    {uiText.add}
                  </Link>
                )}
              </div>
            ) : null}
            {!isTrial && <UserMenu hideNavigationLinksOnDesktop />}
          </div>
        </div>
      </div>
    </header>
  );
}
