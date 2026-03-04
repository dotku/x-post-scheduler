"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface NewKeyInfo extends ApiKeyInfo {
  rawKey: string;
}

export default function ApiKeyManager({ locale }: { locale: string }) {
  const isZh = locale === "zh";
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<NewKeyInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json();
      if (res.ok) setKeys(data.keys);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setNewKey(data.key);
      setNewKeyName("");
      fetchKeys();
    } catch {
      setError(isZh ? "创建失败" : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    const confirmed = window.confirm(
      isZh
        ? "确定要撤销此 API 密钥吗？此操作不可撤回。"
        : "Are you sure you want to revoke this API key? This cannot be undone.",
    );
    if (!confirmed) return;
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/settings/api-keys/${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(d: string | null) {
    if (!d) return isZh ? "从未" : "Never";
    return new Date(d).toLocaleDateString(isZh ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* New key created — show once */}
      {newKey && (
        <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
            {isZh
              ? "API 密钥创建成功！请立即复制，之后将无法再次查看。"
              : "API key created! Copy it now — you won't be able to see it again."}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-gray-900 rounded px-3 py-2 text-sm font-mono border border-green-300 dark:border-green-700 break-all">
              {newKey.rawKey}
            </code>
            <button
              onClick={() => copyToClipboard(newKey.rawKey)}
              className="shrink-0 px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
            >
              {copied ? (isZh ? "已复制" : "Copied!") : (isZh ? "复制" : "Copy")}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-green-700 dark:text-green-400 hover:underline"
          >
            {isZh ? "关闭" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {isZh ? "创建新密钥" : "Create New Key"}
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder={isZh ? "例如：生产环境" : "e.g., Production App"}
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="shrink-0 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating
              ? (isZh ? "创建中..." : "Creating...")
              : (isZh ? "创建密钥" : "Create Key")}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {isZh ? "每个账号最多 5 个密钥" : "Maximum 5 keys per account"}
        </p>
      </div>

      {/* Key list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {isZh ? "已有密钥" : "Your API Keys"}{" "}
          <span className="text-gray-400 font-normal">({keys.length})</span>
        </h3>

        {loading ? (
          <div className="text-sm text-gray-500">{isZh ? "加载中..." : "Loading..."}</div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isZh
                ? "还没有 API 密钥。创建一个即可开始使用 xPilot API。"
                : "No API keys yet. Create one to start using the xPilot API."}
            </p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {key.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                  {key.keyPrefix}...
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {isZh ? "创建" : "Created"}: {formatDate(key.createdAt)}
                  {" · "}
                  {isZh ? "最近使用" : "Last used"}: {formatDate(key.lastUsedAt)}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                disabled={revoking === key.id}
                className="shrink-0 px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
              >
                {revoking === key.id
                  ? (isZh ? "撤销中..." : "Revoking...")
                  : (isZh ? "撤销" : "Revoke")}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
