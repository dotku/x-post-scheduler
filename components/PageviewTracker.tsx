"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SESSION_ID_KEY = "pv-session-id";
const SENT_KEY = "pv-sent-paths";
const INFLIGHT_KEY = "pv-inflight-paths";

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

function getInflightPaths() {
  const raw = sessionStorage.getItem(INFLIGHT_KEY);
  if (!raw) return new Set<string>();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set<string>();
  }
}

function saveInflightPaths(paths: Set<string>) {
  sessionStorage.setItem(INFLIGHT_KEY, JSON.stringify(Array.from(paths)));
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

    const inflight = getInflightPaths();
    if (inflight.has(fullPath)) return;

    const sessionId = getSessionId();
    inflight.add(fullPath);
    saveInflightPaths(inflight);

    let cancelled = false;

    const send = async () => {
      const delays = [0, 1200, 3500];
      for (const delay of delays) {
        if (cancelled) return;
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (cancelled) return;
        }

        try {
          const res = await fetch("/api/analytics/pageview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: fullPath,
              referrer: document.referrer || null,
              sessionId,
            }),
            keepalive: true,
          });
          if (!res.ok) continue;

          const sentNow = getSentPaths();
          sentNow.add(fullPath);
          saveSentPaths(sentNow);
          const inflightNow = getInflightPaths();
          inflightNow.delete(fullPath);
          saveInflightPaths(inflightNow);
          return;
        } catch {
          // Retry with backoff below.
        }
      }

      const inflightNow = getInflightPaths();
      inflightNow.delete(fullPath);
      saveInflightPaths(inflightNow);
    };

    void send();

    return () => {
      cancelled = true;
    };
  }, [pathname, search]);

  return null;
}
