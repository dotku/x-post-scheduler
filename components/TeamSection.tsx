"use client";

import { useEffect, useState, useCallback } from "react";

interface TeamInfo {
  teamId: string;
  name: string;
  inviteCode: string;
  creditBalanceCents: number;
  memberCount: number;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  teamId: string;
  team: { id: string; name: string };
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  name: string | null;
  email: string | null;
  picture: string | null;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
}

interface TeamDetail {
  id: string;
  name: string;
  inviteCode: string;
  creditBalanceCents: number;
  role: "owner" | "editor" | "viewer";
  members: TeamMember[];
  invitations: TeamInvitation[];
}

export default function TeamSection({
  tr,
}: {
  tr: (en: string, zh: string) => string;
}) {
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teams);
        setPendingInvites(data.pendingInvites);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const loadTeamDetail = async (teamId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/team/${teamId}`);
      if (res.ok) {
        setSelectedTeam(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (res.ok) {
        setNewTeamName("");
        setMessage({
          type: "success",
          text: tr("Team created!", "团队已创建!"),
        });
        await fetchTeams();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/team/${selectedTeam.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        setMessage({
          type: "success",
          text: tr("Invitation sent!", "邀请已发送!"),
        });
        await loadTeamDetail(selectedTeam.id);
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvite = async (invite: PendingInvite) => {
    try {
      const res = await fetch(`/api/team/${invite.teamId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId: invite.id }),
      });
      if (res.ok) {
        setMessage({
          type: "success",
          text: tr(`Joined ${invite.team.name}!`, `已加入 ${invite.team.name}!`),
        });
        await fetchTeams();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const handleTransferCredits = async () => {
    if (!selectedTeam) return;
    const cents = Math.floor(parseFloat(transferAmount) * 100);
    if (!cents || cents <= 0) return;
    setTransferring(true);
    try {
      const res = await fetch(`/api/team/${selectedTeam.id}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      if (res.ok) {
        setTransferAmount("");
        setMessage({
          type: "success",
          text: tr(
            `Transferred $${(cents / 100).toFixed(2)} to team!`,
            `已转入 $${(cents / 100).toFixed(2)} 至团队!`,
          ),
        });
        await loadTeamDetail(selectedTeam.id);
        await fetchTeams();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setTransferring(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(
        `/api/team/${selectedTeam.id}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await loadTeamDetail(selectedTeam.id);
        setMessage({
          type: "success",
          text: tr("Member removed", "已移除成员"),
        });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!selectedTeam) return;
    try {
      const res = await fetch(
        `/api/team/${selectedTeam.id}/invite?id=${invitationId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await loadTeamDetail(selectedTeam.id);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    if (
      !confirm(
        tr(
          `Delete team "${selectedTeam.name}"? This cannot be undone.`,
          `删除团队"${selectedTeam.name}"？此操作无法撤销。`,
        ),
      )
    )
      return;
    try {
      const res = await fetch(`/api/team/${selectedTeam.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSelectedTeam(null);
        setMessage({
          type: "success",
          text: tr("Team deleted", "团队已删除"),
        });
        await fetchTeams();
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const copyInviteCode = () => {
    if (!selectedTeam) return;
    navigator.clipboard.writeText(selectedTeam.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return tr("Owner", "所有者");
      case "editor":
        return tr("Editor", "编辑");
      case "viewer":
        return tr("Viewer", "查看者");
      default:
        return role;
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "editor":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {tr("Teams", "团队")}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {tr("Loading...", "加载中...")}
        </p>
      </div>
    );
  }

  // Team detail view
  if (selectedTeam) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {message && (
          <div
            className={`rounded-lg p-3 mb-4 text-sm ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedTeam(null)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              &larr;
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedTeam.name}
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${roleBadgeColor(selectedTeam.role)}`}
            >
              {roleLabel(selectedTeam.role)}
            </span>
          </div>
          {selectedTeam.role === "owner" && (
            <button
              onClick={handleDeleteTeam}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              {tr("Delete Team", "删除团队")}
            </button>
          )}
        </div>

        {/* Credit Balance */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tr("Team Credits", "团队点数")}
              </p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${(selectedTeam.creditBalanceCents / 100).toFixed(2)}
              </p>
            </div>
            {selectedTeam.role === "owner" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="$0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-24 px-2 py-1.5 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                />
                <button
                  onClick={handleTransferCredits}
                  disabled={transferring || !transferAmount}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {transferring
                    ? tr("Transferring...", "转入中...")
                    : tr("Transfer", "转入")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Invite Code */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {tr("Invite Code", "邀请码")}
          </p>
          <div className="flex items-center gap-2">
            <code className="text-lg font-mono text-gray-900 dark:text-white">
              {selectedTeam.inviteCode}
            </code>
            <button
              onClick={copyInviteCode}
              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {copiedCode ? tr("Copied!", "已复制!") : tr("Copy", "复制")}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {tr(
              "Share this code for others to join as Viewer",
              "分享此邀请码，他人可以查看者身份加入",
            )}
          </p>
        </div>

        {/* Members */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {tr("Members", "成员")} ({selectedTeam.members.length})
          </h3>
          <div className="space-y-2">
            {selectedTeam.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {m.picture ? (
                    <img
                      src={m.picture}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                      {(m.name || m.email || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {m.name || m.email || "Unknown"}
                    </p>
                    {m.email && m.name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {m.email}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${roleBadgeColor(m.role)}`}
                  >
                    {roleLabel(m.role)}
                  </span>
                </div>
                {selectedTeam.role === "owner" && m.role !== "owner" && (
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    {tr("Remove", "移除")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pending Invitations */}
        {selectedTeam.invitations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {tr("Pending Invitations", "待处理邀请")}
            </h3>
            <div className="space-y-2">
              {selectedTeam.invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                >
                  <div>
                    <p className="text-sm text-gray-900 dark:text-gray-200">
                      {inv.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {roleLabel(inv.role)}
                    </p>
                  </div>
                  {selectedTeam.role === "owner" && (
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                    >
                      {tr("Revoke", "撤销")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite by email (owner only) */}
        {selectedTeam.role === "owner" && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {tr("Invite Member", "邀请成员")}
            </h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder={tr("Email address", "邮箱地址")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as "editor" | "viewer")
                }
                className="px-3 py-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
              >
                <option value="editor">{tr("Editor", "编辑")}</option>
                <option value="viewer">{tr("Viewer", "查看者")}</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting
                  ? tr("Sending...", "发送中...")
                  : tr("Send Invite", "发送邀请")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Team list view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {message && (
        <div
          className={`rounded-lg p-3 mb-4 text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {tr("Teams", "团队")}
      </h2>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-2">
            {tr("Pending Invitations", "待处理邀请")}
          </h3>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {inv.team.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tr(`Invited as ${inv.role}`, `邀请为${roleLabel(inv.role)}`)}
                  </p>
                </div>
                <button
                  onClick={() => handleAcceptInvite(inv)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  {tr("Accept", "接受")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team list */}
      {teams.length > 0 ? (
        <div className="space-y-2 mb-4">
          {teams.map((t) => (
            <button
              key={t.teamId}
              onClick={() => loadTeamDetail(t.teamId)}
              className="w-full text-left p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t.name}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${roleBadgeColor(t.role)}`}
                  >
                    {roleLabel(t.role)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    {t.memberCount} {tr("members", "成员")}
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    ${(t.creditBalanceCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {tr(
            "You are not part of any team yet.",
            "你还没有加入任何团队。",
          )}
        </p>
      )}

      {/* Create team */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={tr("New team name", "新团队名称")}
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          maxLength={50}
          className="flex-1 px-3 py-2 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
          onKeyDown={(e) => e.key === "Enter" && handleCreateTeam()}
        />
        <button
          onClick={handleCreateTeam}
          disabled={creating || !newTeamName.trim()}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {creating
            ? tr("Creating...", "创建中...")
            : tr("Create Team", "创建团队")}
        </button>
      </div>
    </div>
  );
}
