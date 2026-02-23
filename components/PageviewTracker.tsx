"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_ID_KEY = "pv-session-id";
const SENT_KEY = "pv-sent-paths";

function getSessionId() {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(SESSION_ID_KEY, generated);
  return generated;
}

function getSentPaths() {
  const raw = sessionStorage.getItem(SENT_KEY);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

function saveSentPaths(paths: Set<string>) {
  sessionStorage.setItem(SENT_KEY, JSON.stringify(Array.from(paths)));
}

export default function PageviewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const path = pathname || "/";
    const query = search?.toString();
    const fullPath = query ? `${path}?${query}` : path;

    const sent = getSentPaths();
    if (sent.has(fullPath)) return;

    const sessionId = getSessionId();
    sent.add(fullPath);
    saveSentPaths(sent);

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: fullPath,
        referrer: document.referrer || null,
        sessionId,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname, search]);

  return null;
}

