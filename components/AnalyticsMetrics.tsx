"use client";

import { useTranslations } from "next-intl";

interface AnalyticsMetricsProps {
  totalFollowers: number;
  totalPosts: number;
  totalImpressions: number;
  totalEngagements: number;
  totalComments: number;
}

export default function AnalyticsMetrics({
  totalFollowers,
  totalPosts,
  totalImpressions,
  totalEngagements,
  totalComments,
}: AnalyticsMetricsProps) {
  const t = useTranslations("analytics");

  const metrics = [
    {
      label: t("totalFollowers"),
      value: totalFollowers.toLocaleString(),
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-700 dark:text-blue-400",
    },
    {
      label: t("totalPosts"),
      value: totalPosts.toLocaleString(),
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
      textColor: "text-purple-700 dark:text-purple-400",
    },
    {
      label: t("totalImpressions"),
      value: totalImpressions.toLocaleString(),
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-700 dark:text-orange-400",
    },
    {
      label: t("totalEngagements"),
      value: totalEngagements.toLocaleString(),
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
      textColor: "text-pink-700 dark:text-pink-400",
    },
    {
      label: t("totalComments"),
      value: totalComments.toLocaleString(),
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
      textColor: "text-indigo-700 dark:text-indigo-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={`${metric.bgColor} rounded-lg p-4 text-center`}
        >
          <p className={`text-2xl font-bold ${metric.textColor}`}>
            {metric.value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {metric.label}
          </p>
        </div>
      ))}
    </div>
  );
}
