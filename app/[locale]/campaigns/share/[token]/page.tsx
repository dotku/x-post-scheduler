"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import ReactMarkdown from "react-markdown";

interface SharedMaterial {
  knowledgeSource: { name: string; url: string; type: string } | null;
  knowledgeImage: { blobUrl: string; altText: string | null; mediaType: string } | null;
  note: string | null;
}

interface SharedAttachment {
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
}

interface BudgetItem {
  category: string;
  item: string;
  amountCents: number;
  reasoning: string;
}

interface BudgetData {
  currency: string;
  items: BudgetItem[];
  totalCents: number;
  summary: string;
}

interface SharedCampaign {
  name: string;
  client: string | null;
  description: string | null;
  status: string;
  budgetCents: number | null;
  budgetNote: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  aiAnalysis: string | null;
  aiAnalyzedAt: string | null;
  aiBudget: string | null;
  aiBudgetAt: string | null;
  materials: SharedMaterial[];
  attachments: SharedAttachment[];
  paymentStatus: string | null;
  paidAt: string | null;
  clientSignedName: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  internal_review: "bg-orange-100 text-orange-700",
  client_review: "bg-purple-100 text-purple-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-yellow-100 text-yellow-700",
};

// Payment is only available when campaign is in client_review or later
const PAYMENT_ELIGIBLE_STATUSES = ["client_review", "active", "completed"];

export default function SharedCampaignPage() {
  const t = useTranslations("campaigns");
  const locale = useLocale();
  const params = useParams();
  const token = params.token as string;

  const searchParams = useSearchParams();
  const paymentResult = searchParams.get("payment");

  const [campaign, setCampaign] = useState<SharedCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sign & Pay form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShared = async () => {
      try {
        const res = await fetch(`/api/campaigns/share/${token}`);
        if (res.ok) {
          const data = await res.json();
          setCampaign(data);
        } else {
          setError(res.status === 404 ? "not_found" : "error");
        }
      } catch {
        setError("error");
      } finally {
        setLoading(false);
      }
    };
    fetchShared();
  }, [token]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const parseBudgetData = (jsonStr: string | null): BudgetData | null => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const handleSignAndPay = async () => {
    setSubmitting(true);
    setPaymentError(null);
    try {
      const res = await fetch(`/api/campaigns/share/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentError(data.error || "Payment failed");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPaymentError(locale === "zh" ? "发生错误" : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-lg">
            {error === "not_found"
              ? locale === "zh" ? "链接无效或分享已关闭" : "This link is invalid or sharing has been disabled"
              : locale === "zh" ? "加载失败" : "Failed to load"}
          </p>
        </div>
      </div>
    );
  }

  const budgetData = parseBudgetData(campaign.aiBudget);

  // Group budget items by category
  const groupedBudget = budgetData
    ? budgetData.items.reduce<Record<string, BudgetItem[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {})
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            {t("sharedCampaign")}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {campaign.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                STATUS_COLORS[campaign.status] || STATUS_COLORS.draft
              }`}
            >
              {t(campaign.status as "draft" | "internal_review" | "client_review" | "active" | "completed" | "archived")}
            </span>
            {campaign.client && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {campaign.client}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Campaign Info */}
        <div>
          {campaign.description && (
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {campaign.description}
            </p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
            {campaign.budgetCents != null && (
              <span>{t("budget")}: ${(campaign.budgetCents / 100).toLocaleString()}</span>
            )}
            {campaign.budgetNote && <span>({campaign.budgetNote})</span>}
            {campaign.startDate && (
              <span>{t("startDate")}: {formatDate(campaign.startDate)}</span>
            )}
            {campaign.endDate && (
              <span>{t("endDate")}: {formatDate(campaign.endDate)}</span>
            )}
          </div>

          {campaign.notes && (
            <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {campaign.notes}
            </div>
          )}
        </div>

        {/* Materials */}
        {campaign.materials.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t("materials")} ({campaign.materials.length})
            </h2>
            <div className="space-y-2">
              {campaign.materials.map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {m.knowledgeImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.knowledgeImage.blobUrl}
                      alt={m.knowledgeImage.altText || ""}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    {m.knowledgeSource && (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {m.knowledgeSource.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {m.knowledgeSource.type === "weixin_channel"
                            ? "WeChat Channel"
                            : m.knowledgeSource.url}
                        </p>
                      </>
                    )}
                    {m.note && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {m.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {campaign.attachments.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t("attachments")} ({campaign.attachments.length})
            </h2>
            <div className="space-y-2">
              {campaign.attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  {att.fileType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.blobUrl}
                      alt={att.fileName}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                        {att.fileType.split("/").pop()?.slice(0, 4)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <a
                      href={att.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                    >
                      {att.fileName}
                    </a>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(att.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {campaign.aiAnalysis && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t("aiAnalysis")}
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              {campaign.aiAnalyzedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {t("analysisGenerated")}: {formatDate(campaign.aiAnalyzedAt)}
                </p>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{campaign.aiAnalysis}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* AI Budget */}
        {budgetData && groupedBudget && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t("aiBudget")}
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              {campaign.aiBudgetAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {formatDate(campaign.aiBudgetAt)}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                        {t("budgetCategory")}
                      </th>
                      <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                        {t("budgetItem")}
                      </th>
                      <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {t("budgetAmount")}
                      </th>
                      <th className="text-left py-2 font-medium text-gray-500 dark:text-gray-400">
                        {t("budgetReasoning")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedBudget).map(([category, items]) =>
                      items.map((item, idx) => (
                        <tr
                          key={`${category}-${idx}`}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          {idx === 0 ? (
                            <td
                              rowSpan={items.length}
                              className="py-2.5 pr-4 font-medium text-gray-900 dark:text-white align-top"
                            >
                              {category}
                            </td>
                          ) : null}
                          <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">
                            {item.item}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-gray-900 dark:text-white whitespace-nowrap">
                            ${(item.amountCents / 100).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                            {item.reasoning}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td
                        colSpan={2}
                        className="py-3 pr-4 font-bold text-gray-900 dark:text-white text-base"
                      >
                        {t("budgetTotal")}
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-gray-900 dark:text-white text-base whitespace-nowrap">
                        ${(budgetData.totalCents / 100).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {budgetData.summary && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {t("budgetSummary")}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {budgetData.summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Success/Cancel Banner */}
        {paymentResult === "success" && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <p className="text-green-700 dark:text-green-300 font-medium">
              {t("paymentSuccess")}
            </p>
          </div>
        )}
        {paymentResult === "cancelled" && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-center">
            <p className="text-yellow-700 dark:text-yellow-300 font-medium">
              {t("paymentCancelled")}
            </p>
          </div>
        )}

        {/* Already Paid Indicator */}
        {campaign.paymentStatus === "paid" && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center">
            <div className="text-green-600 dark:text-green-400 text-3xl mb-2">&#10003;</div>
            <p className="font-semibold text-green-700 dark:text-green-300 text-lg">
              {t("campaignSigned")}
            </p>
            {campaign.clientSignedName && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {t("signedBy")}: {campaign.clientSignedName}
              </p>
            )}
            {campaign.paidAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatDate(campaign.paidAt)}
              </p>
            )}
          </div>
        )}

        {/* Sign & Pay Section */}
        {campaign.budgetCents && campaign.budgetCents > 0 && campaign.paymentStatus !== "paid" && PAYMENT_ELIGIBLE_STATUSES.includes(campaign.status) && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-blue-200 dark:border-blue-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t("signAndPay")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t("signAndPayDescription")}
            </p>

            {/* Fee breakdown */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{t("campaignBudget")}</span>
                <span className="text-gray-900 dark:text-white">
                  ${(campaign.budgetCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t("platformFee")} (3%)</span>
                <span className="text-gray-500 dark:text-gray-400">
                  ${(Math.ceil(campaign.budgetCents * 0.03) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-1.5 flex justify-between font-semibold">
                <span className="text-gray-900 dark:text-white">{t("totalDue")}</span>
                <span className="text-gray-900 dark:text-white">
                  ${((campaign.budgetCents + Math.ceil(campaign.budgetCents * 0.03)) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Client form */}
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder={t("clientNamePlaceholder")}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder={t("clientEmailPlaceholder")}
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {paymentError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{paymentError}</p>
            )}

            <button
              onClick={handleSignAndPay}
              disabled={submitting || !clientName.trim() || !clientEmail.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? t("processing") : t("confirmAndPay")}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 pb-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {t("poweredBy")}
          </p>
        </div>
      </div>
    </div>
  );
}
