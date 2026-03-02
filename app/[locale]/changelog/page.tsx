import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog | xPilot",
  description: "Product updates and announcements for xPilot",
};

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const isZh = locale === "zh";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={locale === "zh" ? "/zh" : "/"}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-4 inline-block"
          >
            ← {isZh ? "返回首页" : "Back to Home"}
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {isZh ? "更新日志" : "Changelog"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isZh
              ? "产品更新与重要公告"
              : "Product updates and important announcements"}
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-8">
          {/* 2026-03 Scheduling change */}
          <div className="relative pl-8 pb-8 border-l-2 border-blue-500">
            <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-blue-500"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  {isZh ? "服务调整" : "Service Update"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isZh ? "2026年3月" : "March 2026"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {isZh
                  ? "定时发布调整为每日更新"
                  : "Scheduled Publishing Now Runs Daily"}
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                {isZh ? (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      由于基础设施资源限制，我们对定时任务系统进行了调整。
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      有什么变化？
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
                      <li>
                        <strong>之前：</strong>定时发布任务每分钟检查一次，帖子会在设定的精确时间发布
                      </li>
                      <li>
                        <strong>现在：</strong>所有定时任务合并为每日一次（UTC 01:00），统一处理当日的发布、内容生成和传媒行业动态
                      </li>
                    </ul>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      对您的影响
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      定时发布的帖子将在每日 UTC 01:00（北京时间 09:00）统一处理，而非在您设定的精确时间发布。如果您安排了多个不同时间的帖子，它们将在此时间窗口内集中发布。
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      为什么调整？
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      为了在有限的基础设施资源内保持服务稳定运行，我们将多个定时触发器合并为单一的每日任务。这确保了包括内容生成和传媒动态在内的所有功能都能可靠执行。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Due to infrastructure resource limits, we have consolidated our scheduled task system.
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      What Changed?
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
                      <li>
                        <strong>Before:</strong> Scheduled posts were checked every minute and published at their exact scheduled time
                      </li>
                      <li>
                        <strong>Now:</strong> All scheduled tasks run once daily at 01:00 UTC, handling post publishing, content generation, and media industry news together
                      </li>
                    </ul>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      How This Affects You
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Scheduled posts will be processed during the daily 01:00 UTC window rather than at their exact scheduled time. If you have multiple posts scheduled for different times of the day, they will be published together during this window.
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      Why This Change?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300">
                      To keep the service running reliably within our infrastructure resource limits, we consolidated multiple cron triggers into a single daily job. This ensures all features — including content generation and media industry news — continue to work dependably.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 2026-02 Rebranding */}
          <div className="relative pl-8 pb-8 border-l-2 border-blue-500">
            <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-blue-500"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  {isZh ? "品牌升级" : "Rebranding"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {isZh ? "2026年2月" : "February 2026"}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {isZh
                  ? "X Post Scheduler 正式更名为 xPilot (X 推创)"
                  : "X Post Scheduler Rebrands to xPilot"}
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                {isZh ? (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      我们很高兴地宣布，<strong>X Post Scheduler</strong>{" "}
                      正式更名为{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        xPilot
                      </strong>
                      （中文：
                      <strong className="text-blue-600 dark:text-blue-400">
                        X 推创
                      </strong>
                      ）！
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      为什么更名？
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      随着产品的不断发展，我们已经从单纯的"发帖调度工具"成长为一个全方位的{" "}
                      <strong>社媒营销飞行副驾驶 AI</strong>。xPilot
                      更好地体现了我们的产品定位：
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
                      <li>
                        <strong>AI 驱动的内容创作</strong> -
                        文本、图片、视频全覆盖
                      </li>
                      <li>
                        <strong>智能调度系统</strong> - 自动化发布，解放双手
                      </li>
                      <li>
                        <strong>知识库引擎</strong> - 品牌化内容生成
                      </li>
                      <li>
                        <strong>跨平台分析</strong> - X 曝光量 +
                        站点流量统一监控
                      </li>
                      <li>
                        <strong>多账号管理</strong> - 一处管理所有品牌账号
                      </li>
                    </ul>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      产品功能不变
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      这次更名只是品牌升级，所有现有功能和您的账户数据完全不受影响。您可以继续使用所有服务，无需任何操作。
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      新品牌标识
                    </h3>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                          xPilot
                        </p>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-1">
                          Your Social Marketing Copilot AI
                        </p>
                        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mt-4">
                          X 推创
                        </p>
                        <p className="text-base text-gray-600 dark:text-gray-400">
                          你的社媒营销飞行副驾驶 AI
                        </p>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      特别鸣谢
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      感谢{" "}
                      <a
                        href="https://www.yeoso.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        伊索科技（Yeoso）
                      </a>{" "}
                      提供的技术支持，助力我们完成产品升级！
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      感谢您一直以来的支持！让我们一起用 xPilot
                      开启社媒营销的新篇章。🚀
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      We're excited to announce that{" "}
                      <strong>X Post Scheduler</strong> is now officially{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        xPilot
                      </strong>{" "}
                      (Chinese:{" "}
                      <strong className="text-blue-600 dark:text-blue-400">
                        X 推创
                      </strong>
                      )!
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      Why the Rebrand?
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      As our product has evolved, we've grown from a simple
                      "post scheduler" into a comprehensive{" "}
                      <strong>social marketing copilot AI</strong>. xPilot
                      better reflects our product vision:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 mb-4">
                      <li>
                        <strong>AI-Powered Content Creation</strong> - Text,
                        images, and videos
                      </li>
                      <li>
                        <strong>Smart Scheduling</strong> - Automated
                        publishing, hands-free
                      </li>
                      <li>
                        <strong>Knowledge Base Engine</strong> - Brand-aligned
                        content generation
                      </li>
                      <li>
                        <strong>Cross-Platform Analytics</strong> - X
                        impressions + site traffic in one dashboard
                      </li>
                      <li>
                        <strong>Multi-Account Management</strong> - Manage all
                        your brand accounts in one place
                      </li>
                    </ul>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      Everything Stays the Same
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      This is purely a branding update. All existing features
                      and your account data remain completely unchanged. You can
                      continue using all services without any action required.
                    </p>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      New Brand Identity
                    </h3>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                          xPilot
                        </p>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-1">
                          Your Social Marketing Copilot AI
                        </p>
                        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mt-4">
                          X 推创
                        </p>
                        <p className="text-base text-gray-600 dark:text-gray-400">
                          你的社媒营销飞行副驾驶 AI
                        </p>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-6 mb-3">
                      Special Thanks
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      Special thanks to{" "}
                      <a
                        href="https://www.yeoso.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Yeoso Technology (伊索科技)
                      </a>{" "}
                      for their technical support in making this upgrade
                      possible!
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      Thank you for your continued support! Let's embark on a
                      new chapter of social media marketing with xPilot. 🚀
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Placeholder for future updates */}
          <div className="relative pl-8 pb-8 border-l-2 border-gray-300 dark:border-gray-700">
            <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-gray-300 dark:bg-gray-700"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 opacity-60">
              <p className="text-gray-500 dark:text-gray-400 text-center italic">
                {isZh ? "更多更新敬请期待..." : "More updates coming soon..."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
