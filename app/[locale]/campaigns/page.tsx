"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

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

interface AvailableSource {
  id: string;
  name: string;
  url: string;
  type: string;
}

interface UploadedFile {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

interface Campaign {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: string;
  budgetCents: number | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { materials: number; attachments: number };
}

const STATUS_OPTIONS = ["all", "draft", "active", "completed", "archived"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  archived: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const locale = useLocale();
  const router = useRouter();
  const prefix = locale === "zh" ? "/zh" : "";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [estimatingBudget, setEstimatingBudget] = useState(false);
  const [budgetEstimate, setBudgetEstimate] = useState<BudgetData | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [budgetCents, setBudgetCents] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Source picker state
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const fetchAvailableSources = async () => {
    setLoadingSources(true);
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
    } finally {
      setLoadingSources(false);
    }
  };

  const handleToggleSource = (sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/campaigns/upload", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setUploadedFiles((prev) => [
            ...prev,
            {
              url: data.url,
              fileName: data.fileName,
              fileType: data.fileType,
              fileSize: data.fileSize,
            },
          ]);
        } else {
          const data = await res.json();
          alert(data.error || "Upload failed");
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  // Budget item editing helpers
  const handleBudgetItemChange = (index: number, field: keyof BudgetItem, value: string | number) => {
    if (!budgetEstimate) return;
    const updated = [...budgetEstimate.items];
    if (field === "amountCents") {
      updated[index] = { ...updated[index], amountCents: Math.round(Number(value) * 100) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    const newTotal = updated.reduce((sum, item) => sum + item.amountCents, 0);
    setBudgetEstimate({ ...budgetEstimate, items: updated, totalCents: newTotal });
  };

  const handleRemoveBudgetItem = (index: number) => {
    if (!budgetEstimate) return;
    const updated = budgetEstimate.items.filter((_, i) => i !== index);
    const newTotal = updated.reduce((sum, item) => sum + item.amountCents, 0);
    setBudgetEstimate({ ...budgetEstimate, items: updated, totalCents: newTotal });
  };

  const handleAddBudgetItem = () => {
    if (!budgetEstimate) return;
    const newItem: BudgetItem = { category: "", item: "", amountCents: 0, reasoning: "" };
    setBudgetEstimate({
      ...budgetEstimate,
      items: [...budgetEstimate.items, newItem],
    });
  };

  const handleCreate = async (overrideBudgetCents?: number) => {
    if (!name.trim()) return;
    setCreating(true);
    const finalBudgetCents = overrideBudgetCents !== undefined
      ? overrideBudgetCents
      : budgetCents ? Math.round(parseFloat(budgetCents) * 100) : undefined;
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          client: client.trim() || undefined,
          description: description.trim() || undefined,
          status,
          budgetCents: finalBudgetCents || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          knowledgeSourceIds: selectedSourceIds.length > 0 ? selectedSourceIds : undefined,
          attachments: uploadedFiles.length > 0
            ? uploadedFiles.map((f) => ({
                blobUrl: f.url,
                fileName: f.fileName,
                fileType: f.fileType,
                fileSize: f.fileSize,
              }))
            : undefined,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        router.push(`${prefix}/campaigns/${created.id}?autoGenerate=true`);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Failed to create campaign:", error);
      alert("Network error: Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    }
  };

  const handleEstimateBudget = async () => {
    if (!name.trim()) return;
    setEstimatingBudget(true);
    try {
      const res = await fetch("/api/campaigns/budget-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          client: client.trim() || undefined,
          description: description.trim() || undefined,
          budgetCents: budgetCents ? Math.round(parseFloat(budgetCents) * 100) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          locale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBudgetEstimate(data.budget);
      } else {
        const data = await res.json();
        if (res.status === 402) {
          alert(t("insufficientCredits"));
        } else {
          alert(data.error || "Budget estimation failed");
        }
      }
    } catch (error) {
      console.error("Failed to estimate budget:", error);
    } finally {
      setEstimatingBudget(false);
    }
  };

  const filtered = filter === "all"
    ? campaigns
    : campaigns.filter((c) => c.status === filter);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t("title")}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
                {locale === "zh" ? "← 仪表盘" : "← Dashboard"}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Action Bar */}
      <div className="flex items-center justify-end mb-6">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t("newCampaign")}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("newCampaign")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("name")} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("client")}
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder={t("clientPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("descriptionPlaceholder")}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="draft">{t("draft")}</option>
                <option value="active">{t("active")}</option>
                <option value="completed">{t("completed")}</option>
                <option value="archived">{t("archived")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("budget")} ($)
              </label>
              <input
                type="number"
                value={budgetCents}
                onChange={(e) => setBudgetCents(e.target.value)}
                placeholder={t("budgetPlaceholder")}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("startDate")}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("endDate")}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Knowledge Source Picker */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("linkSources")}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowSourcePicker(!showSourcePicker);
                  if (!showSourcePicker && availableSources.length === 0) {
                    fetchAvailableSources();
                  }
                }}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {showSourcePicker ? t("cancel") : t("addMaterial")}
              </button>
            </div>

            {/* Selected source chips */}
            {selectedSourceIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedSourceIds.map((sourceId) => {
                  const source = availableSources.find((s) => s.id === sourceId);
                  return (
                    <span
                      key={sourceId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                    >
                      {source?.name || sourceId}
                      <button
                        type="button"
                        onClick={() => handleToggleSource(sourceId)}
                        className="ml-0.5 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200"
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Source picker dropdown */}
            {showSourcePicker && (
              <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                {loadingSources ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p>
                ) : availableSources.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {locale === "zh" ? "暂无知识库来源" : "No knowledge sources available"}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {availableSources.map((source) => (
                      <label
                        key={source.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSourceIds.includes(source.id)}
                          onChange={() => handleToggleSource(source.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                          {source.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {source.type === "weixin_channel" ? "WeChat" : "Web"}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t("attachments")}
            </h3>

            {/* Upload area */}
            <label className="block mb-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
                disabled={uploading}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {uploading ? t("uploading") : t("dropOrClick")}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t("supportedFormats")}
              </p>
            </label>

            {/* Uploaded file list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    {file.fileType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.fileName}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                          {file.fileType.split("/").pop()?.slice(0, 4)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setUploadedFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      {t("removeFile")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Budget Estimate */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("aiBudget")}
              </h3>
              <button
                type="button"
                onClick={handleEstimateBudget}
                disabled={estimatingBudget || !name.trim()}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {estimatingBudget
                  ? t("generatingBudget")
                  : budgetEstimate
                    ? t("regenerateBudget")
                    : t("generateBudget")}
              </button>
            </div>

            {budgetEstimate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-600">
                        <th className="text-left py-1.5 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("budgetCategory")}</th>
                        <th className="text-left py-1.5 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("budgetItem")}</th>
                        <th className="text-right py-1.5 pr-2 font-medium text-gray-500 dark:text-gray-400 w-24">{t("budgetAmount")}</th>
                        <th className="text-left py-1.5 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("budgetReasoning")}</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetEstimate.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100 dark:border-gray-600/50">
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              value={item.category}
                              onChange={(e) => handleBudgetItemChange(idx, "category", e.target.value)}
                              className="w-full px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              value={item.item}
                              onChange={(e) => handleBudgetItemChange(idx, "item", e.target.value)}
                              className="w-full px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="number"
                              value={(item.amountCents / 100).toFixed(2)}
                              onChange={(e) => handleBudgetItemChange(idx, "amountCents", e.target.value)}
                              min="0"
                              step="0.01"
                              className="w-full px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs text-right"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="text"
                              value={item.reasoning}
                              onChange={(e) => handleBudgetItemChange(idx, "reasoning", e.target.value)}
                              className="w-full px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[11px]"
                            />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveBudgetItem(idx)}
                              className="text-red-400 hover:text-red-600 text-xs"
                              title={t("removeFile")}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                        <td colSpan={2} className="py-2 pr-2 font-bold text-gray-900 dark:text-white text-sm">{t("budgetTotal")}</td>
                        <td className="py-2 pr-2 text-right font-bold text-gray-900 dark:text-white text-sm whitespace-nowrap">
                          ${(budgetEstimate.totalCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleAddBudgetItem}
                  className="mt-2 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  + {t("addBudgetItem")}
                </button>
                {budgetEstimate.summary && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    {budgetEstimate.summary}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => handleCreate(budgetEstimate.totalCents)}
                  disabled={creating || !name.trim()}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? t("creating") : t("applyAndCreate")} (${(budgetEstimate.totalCents / 100).toLocaleString()})
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleCreate()}
              disabled={creating || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {creating ? t("creating") : t("create")}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {t(s)}
            {s !== "all" && (
              <span className="ml-1 text-xs opacity-70">
                ({campaigns.filter((c) => c.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">
            {t("noCampaigns")}
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            {t("createFirst")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`${prefix}/campaigns/${campaign.id}`}
                  className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
                >
                  {campaign.name}
                </Link>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    STATUS_COLORS[campaign.status] || STATUS_COLORS.draft
                  }`}
                >
                  {t(campaign.status)}
                </span>
              </div>

              {campaign.client && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {campaign.client}
                </p>
              )}

              {campaign.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                  {campaign.description}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                {campaign.budgetCents && (
                  <span>${(campaign.budgetCents / 100).toLocaleString()}</span>
                )}
                {(campaign.startDate || campaign.endDate) && (
                  <span>
                    {formatDate(campaign.startDate)}
                    {campaign.startDate && campaign.endDate && " – "}
                    {formatDate(campaign.endDate)}
                  </span>
                )}
                <span>
                  {t("materialCount", {
                    count: campaign._count?.materials ?? 0,
                  })}
                </span>
                {(campaign._count?.attachments ?? 0) > 0 && (
                  <span>
                    {t("attachmentCount", {
                      count: campaign._count?.attachments ?? 0,
                    })}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <Link
                  href={`${prefix}/campaigns/${campaign.id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t("editCampaign")}
                </Link>
                <button
                  onClick={() => handleDelete(campaign.id)}
                  className="text-sm text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {t("deleteCampaign")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
