"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import ReactMarkdown from "react-markdown";

interface KnowledgeSourceRef {
  id: string;
  name: string;
  url: string;
  type: string;
  content?: string;
}

interface KnowledgeImageRef {
  id: string;
  blobUrl: string;
  altText: string | null;
  mimeType: string | null;
  mediaType: string;
}

interface CampaignMaterial {
  id: string;
  note: string | null;
  createdAt: string;
  knowledgeSource: KnowledgeSourceRef | null;
  knowledgeImage: KnowledgeImageRef | null;
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

interface CampaignAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl: string;
  note: string | null;
  createdAt: string;
}

interface Campaign {
  id: string;
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
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
  materials: CampaignMaterial[];
  attachments: CampaignAttachment[];
  payment: {
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    paymentStatus: string;
    budgetCents: number;
    platformFeeCents: number;
    totalChargeCents: number;
    ownerPayoutCents: number;
    paidAt: string | null;
  } | null;
}

interface AvailableSource {
  id: string;
  name: string;
  url: string;
  type: string;
}

const STATUS_OPTIONS = ["draft", "internal_review", "client_review", "active", "completed", "archived"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  internal_review: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  client_review: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  archived: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function CampaignDetailPage() {
  const t = useTranslations("campaigns");
  const locale = useLocale();
  const prefix = locale === "zh" ? "/zh" : "";
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const autoGenerate = searchParams.get("autoGenerate") === "true";
  const autoGenerateTriggered = useRef(false);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingBudget, setGeneratingBudget] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editBudget, setEditBudget] = useState("");
  const [editBudgetNote, setEditBudgetNote] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Material picker
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);

  // Attachment upload
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // AI refine assistant
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refining, setRefining] = useState(false);

  // Share
  const [togglingShare, setTogglingShare] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaign:", error);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Auto-generate analysis (and budget if budgetCents set) after creation
  useEffect(() => {
    if (!autoGenerate || autoGenerateTriggered.current || !campaign || loading) return;
    autoGenerateTriggered.current = true;

    const run = async () => {
      // Always generate analysis
      setAnalyzing(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 402) {
            alert(t("insufficientCredits"));
          } else {
            console.error("Auto-analysis failed:", data.error);
          }
        }
      } catch (e) {
        console.error("Auto-analysis error:", e);
      } finally {
        setAnalyzing(false);
      }

      // Generate budget if budget was set
      if (campaign.budgetCents) {
        setGeneratingBudget(true);
        try {
          const res = await fetch(`/api/campaigns/${campaignId}/budget`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            if (res.status === 402) {
              alert(t("insufficientCredits"));
            } else {
              console.error("Auto-budget failed:", data.error);
            }
          }
        } catch (e) {
          console.error("Auto-budget error:", e);
        } finally {
          setGeneratingBudget(false);
        }
      }

      // Refresh campaign data after auto-generation
      fetchCampaign();
    };

    run();
  }, [autoGenerate, campaign, loading, campaignId, fetchCampaign, t]);

  const startEditing = () => {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditClient(campaign.client || "");
    setEditDescription(campaign.description || "");
    setEditStatus(campaign.status);
    setEditBudget(campaign.budgetCents ? (campaign.budgetCents / 100).toString() : "");
    setEditBudgetNote(campaign.budgetNote || "");
    setEditStartDate(campaign.startDate ? campaign.startDate.split("T")[0] : "");
    setEditEndDate(campaign.endDate ? campaign.endDate.split("T")[0] : "");
    setEditNotes(campaign.notes || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          client: editClient.trim() || null,
          description: editDescription.trim() || null,
          status: editStatus,
          budgetCents: editBudget ? Math.round(parseFloat(editBudget) * 100) : null,
          budgetNote: editBudgetNote.trim() || null,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
          notes: editNotes || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to save campaign:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const fetchAvailableSources = async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        setAvailableSources(
          data.map((s: AvailableSource) => ({
            id: s.id,
            name: s.name,
            url: s.url,
            type: s.type,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch sources:", error);
    }
  };

  const handleAddMaterial = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knowledgeSourceId: sourceId }),
      });
      if (res.ok) {
        setShowAddMaterial(false);
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to add material:", error);
    }
  };

  const handleRemoveMaterial = async (materialId: string) => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/materials?materialId=${materialId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to remove material:", error);
    }
  };

  const handleUploadAttachment = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/campaigns/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          alert(data.error || "Upload failed");
          continue;
        }
        const uploaded = await uploadRes.json();
        await fetch(`/api/campaigns/${campaignId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blobUrl: uploaded.url,
            fileName: uploaded.fileName,
            fileType: uploaded.fileType,
            fileSize: uploaded.fileSize,
          }),
        });
      }
      fetchCampaign();
    } catch (error) {
      console.error("Failed to upload attachment:", error);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/attachments?attachmentId=${attachmentId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to remove attachment:", error);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (res.ok) {
        fetchCampaign();
      } else {
        const data = await res.json();
        if (res.status === 402) {
          alert(t("insufficientCredits"));
        } else {
          alert(data.error || "Analysis failed");
        }
      }
    } catch (error) {
      console.error("Failed to analyze:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateBudget = async () => {
    setGeneratingBudget(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (res.ok) {
        fetchCampaign();
      } else {
        const data = await res.json();
        if (res.status === 402) {
          alert(t("insufficientCredits"));
        } else {
          alert(data.error || "Budget generation failed");
        }
      }
    } catch (error) {
      console.error("Failed to generate budget:", error);
    } finally {
      setGeneratingBudget(false);
    }
  };

  const handleRefineAnalysis = async () => {
    if (!refinePrompt.trim() || !campaign?.aiAnalysis) return;
    setRefining(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: refinePrompt.trim(),
          currentContent: campaign.aiAnalysis,
          locale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Optimistic update — show refined content immediately
        setCampaign((prev) =>
          prev
            ? { ...prev, aiAnalysis: data.analysis, aiAnalyzedAt: new Date().toISOString() }
            : prev
        );
        setRefinePrompt("");
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) {
          alert(t("insufficientCredits"));
        } else {
          alert(data.error || "Refine failed");
        }
      }
    } catch (error) {
      console.error("Failed to refine analysis:", error);
      alert("Network error: Failed to refine analysis");
    } finally {
      setRefining(false);
    }
  };

  const handleApplyBudget = async (totalCents: number) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetCents: totalCents }),
      });
      if (res.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error("Failed to apply budget:", error);
    }
  };

  const handleToggleShare = async (enable: boolean) => {
    setTogglingShare(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableShare: enable }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaign((prev) =>
          prev ? { ...prev, shareToken: data.shareToken } : prev
        );
      }
    } catch (error) {
      console.error("Failed to toggle share:", error);
    } finally {
      setTogglingShare(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!campaign?.shareToken) return;
    const url = `${window.location.origin}${prefix}/campaigns/share/${campaign.shareToken}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const parseBudgetData = (jsonStr: string | null): BudgetData | null => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Campaign not found</p>
        <Link href={`${prefix}/campaigns`} className="text-blue-600 hover:underline mt-2 inline-block">
          {t("backToList")}
        </Link>
      </div>
    );
  }

  // Filter out already-linked sources
  const linkedSourceIds = new Set(
    campaign.materials
      .filter((m) => m.knowledgeSource)
      .map((m) => m.knowledgeSource!.id)
  );
  const unlinkedSources = availableSources.filter((s) => !linkedSourceIds.has(s.id));

  return (
    <div>
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              {campaign.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link
                href={`${prefix}/campaigns`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {t("backToList")}
              </Link>
              <Link
                href={`${prefix}/knowledge`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {locale === "zh" ? "知识库" : "Knowledge Base"}
              </Link>
              <Link
                href={`${prefix}/dashboard`}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {locale === "zh" ? "仪表盘" : "Dashboard"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Campaign Info */}
      <div className="mb-6">

        {editing ? (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("name")} *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("client")}
                </label>
                <input
                  type="text"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("description")}
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("status")}
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{t(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("budget")} ($)
                </label>
                <input
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("startDate")}
                </label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("endDate")}
                </label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("budgetNote")}
                </label>
                <input
                  type="text"
                  value={editBudgetNote}
                  onChange={(e) => setEditBudgetNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("notes")}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder={t("notesPlaceholder")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {campaign.name}
              </h1>
              <select
                value={campaign.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`px-2 py-0.5 text-xs font-medium rounded-full border-0 cursor-pointer ${
                  STATUS_COLORS[campaign.status] || STATUS_COLORS.draft
                }`}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{t(s)}</option>
                ))}
              </select>
              <button
                onClick={startEditing}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("editCampaign")}
              </button>
              {!campaign.shareToken && (
                <button
                  onClick={() => handleToggleShare(true)}
                  disabled={togglingShare}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                >
                  {togglingShare ? "..." : t("enableSharing")}
                </button>
              )}
            </div>

            {/* Share Controls */}
            {campaign.shareToken && (
              <div className="mt-2 flex flex-wrap items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-xs text-green-700 dark:text-green-300 truncate max-w-xs sm:max-w-md">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}${prefix}/campaigns/share/${campaign.shareToken}`}
                </span>
                <button
                  onClick={handleCopyShareLink}
                  className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                >
                  {linkCopied ? t("linkCopied") : t("copyLink")}
                </button>
                <button
                  onClick={() => handleToggleShare(false)}
                  disabled={togglingShare}
                  className="px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 whitespace-nowrap"
                >
                  {t("disableSharing")}
                </button>
              </div>
            )}

            {/* Payment Status */}
            {campaign.payment && (
              <div className={`mt-2 p-3 rounded-lg border ${
                campaign.payment.paymentStatus === "paid"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      campaign.payment.paymentStatus === "paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-300"
                    }`}>
                      {campaign.payment.paymentStatus === "paid" ? t("paymentPaid") : t("paymentPending")}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {campaign.payment.clientName} ({[campaign.payment.clientEmail, campaign.payment.clientPhone].filter(Boolean).join(" / ")})
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">
                      ${(campaign.payment.totalChargeCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t("ownerPayout")}: ${(campaign.payment.ownerPayoutCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                {campaign.payment.paidAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("paidOn")}: {formatDate(campaign.payment.paidAt)}
                  </p>
                )}
              </div>
            )}

            {campaign.client && (
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {campaign.client}
              </p>
            )}
            {campaign.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                {campaign.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
              {campaign.budgetCents && (
                <span>{t("budget")}: ${(campaign.budgetCents / 100).toLocaleString()}</span>
              )}
              {campaign.budgetNote && (
                <span>({campaign.budgetNote})</span>
              )}
              {campaign.startDate && (
                <span>{t("startDate")}: {formatDate(campaign.startDate)}</span>
              )}
              {campaign.endDate && (
                <span>{t("endDate")}: {formatDate(campaign.endDate)}</span>
              )}
            </div>

            {campaign.notes && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {campaign.notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Materials Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("materials")} ({campaign.materials.length})
          </h2>
          <button
            onClick={() => {
              setShowAddMaterial(!showAddMaterial);
              if (!showAddMaterial) fetchAvailableSources();
            }}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t("addMaterial")}
          </button>
        </div>

        {/* Material Picker */}
        {showAddMaterial && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t("selectSource")}
            </h3>
            {unlinkedSources.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {availableSources.length === 0
                  ? "Loading..."
                  : locale === "zh"
                    ? "所有知识库来源已关联"
                    : "All knowledge sources are already linked"}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unlinkedSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleAddMaterial(source.id)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {source.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {source.type === "weixin_channel" ? "WeChat" : "Web"}
                      </span>
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100">
                      + {t("addMaterial")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Linked Materials */}
        {campaign.materials.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            {t("noMaterials")}
          </p>
        ) : (
          <div className="space-y-2">
            {campaign.materials.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {material.knowledgeImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={material.knowledgeImage.blobUrl}
                      alt={material.knowledgeImage.altText || ""}
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    {material.knowledgeSource && (
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {material.knowledgeSource.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {material.knowledgeSource?.type === "weixin_channel"
                        ? "WeChat Channel"
                        : material.knowledgeSource?.url}
                    </p>
                    {material.note && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {material.note}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMaterial(material.id)}
                  className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
                >
                  {t("removeMaterial")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attachments Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("attachments")} ({campaign.attachments?.length ?? 0})
          </h2>
          <label className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => handleUploadAttachment(e.target.files)}
              className="hidden"
              disabled={uploadingAttachment}
            />
            {uploadingAttachment ? t("uploading") : t("uploadFiles")}
          </label>
        </div>

        {(!campaign.attachments || campaign.attachments.length === 0) ? (
          <div className="text-center py-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("noAttachments")}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t("supportedFormats")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaign.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
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
                <button
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-2"
                >
                  {t("removeMaterial")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Analysis Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("aiAnalysis")}
          </h2>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {analyzing
              ? t("analyzing")
              : campaign.aiAnalysis
                ? t("regenerateAnalysis")
                : t("generateAnalysis")}
          </button>
        </div>

        {campaign.aiAnalysis ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            {campaign.aiAnalyzedAt && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {t("analysisGenerated")}: {formatDate(campaign.aiAnalyzedAt)}
              </p>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{campaign.aiAnalysis}</ReactMarkdown>
            </div>

            {/* AI Refine Assistant */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                {t("aiAssistant")}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleRefineAnalysis();
                    }
                  }}
                  placeholder={t("refinePlaceholder")}
                  disabled={refining}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleRefineAnalysis}
                  disabled={refining || !refinePrompt.trim()}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {refining ? t("refining") : t("refine")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {locale === "zh"
                ? "添加素材后点击「生成 AI 分析」获取广告策略建议"
                : "Add materials and click 'Generate AI Analysis' to get advertising strategy recommendations"}
            </p>
          </div>
        )}
      </div>

      {/* AI Budget Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("aiBudget")}
          </h2>
          <button
            onClick={handleGenerateBudget}
            disabled={generatingBudget}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {generatingBudget
              ? t("generatingBudget")
              : campaign.aiBudget
                ? t("regenerateBudget")
                : t("generateBudget")}
          </button>
        </div>

        {(() => {
          const budgetData = parseBudgetData(campaign.aiBudget);
          if (!budgetData) {
            return (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {locale === "zh"
                    ? "点击「生成 AI 预算」获取预算推荐方案"
                    : "Click 'Generate AI Budget' to get a budget recommendation"}
                </p>
              </div>
            );
          }

          // Group items by category
          const grouped = budgetData.items.reduce<Record<string, BudgetItem[]>>((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
          }, {});

          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              {campaign.aiBudgetAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {formatDate(campaign.aiBudgetAt)}
                </p>
              )}

              {/* Budget Table */}
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
                    {Object.entries(grouped).map(([category, items]) => (
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
                            ${(item.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 text-gray-500 dark:text-gray-400 text-xs">
                            {item.reasoning}
                          </td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                      <td colSpan={2} className="py-3 pr-4 font-bold text-gray-900 dark:text-white text-base">
                        {t("budgetTotal")}
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-gray-900 dark:text-white text-base whitespace-nowrap">
                        ${(budgetData.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Summary */}
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

              {/* Apply Button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleApplyBudget(budgetData.totalCents)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t("applyBudget")} (${(budgetData.totalCents / 100).toLocaleString()})
                </button>
              </div>
            </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
}
