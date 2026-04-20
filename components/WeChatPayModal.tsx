"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

export type WeChatPayModalProps = {
  /** USD cents — matches TOPUP_OPTIONS. */
  amountCents: number;
  /** Human label in current locale, e.g. "zh" or "en". */
  language: "zh" | "en";
  onClose: () => void;
  /** Called after payment confirmed + credits applied. */
  onSuccess: () => void;
};

type CheckoutResponse = {
  outTradeNo: string;
  codeUrl: string;
  cnyFen: number;
  amountCents: number;
};

type ModalState =
  | { phase: "loading" }
  | { phase: "awaiting"; qrDataUrl: string; outTradeNo: string; cnyFen: number }
  | { phase: "success" }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function tr(language: "zh" | "en", en: string, zh: string) {
  return language === "zh" ? zh : en;
}

export default function WeChatPayModal({
  amountCents,
  language,
  onClose,
  onSuccess,
}: WeChatPayModalProps) {
  const [state, setState] = useState<ModalState>({ phase: "loading" });
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (outTradeNo: string) => {
      pollStartRef.current = Date.now();
      pollTimerRef.current = setInterval(async () => {
        if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
          stopPolling();
          setState({
            phase: "error",
            message: tr(
              language,
              "Payment timed out. Please try again.",
              "支付超时，请重试。",
            ),
          });
          return;
        }
        try {
          const res = await fetch("/api/wechat/fulfill", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outTradeNo }),
          });
          if (res.ok) {
            stopPolling();
            setState({ phase: "success" });
            setTimeout(() => onSuccess(), 1500);
          }
          // 409 = still pending, keep polling
        } catch {
          // Network blip — keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [language, onSuccess, stopPolling],
  );

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/wechat/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents }),
        });
        const data = (await res.json()) as CheckoutResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok || !data.codeUrl) {
          setState({
            phase: "error",
            message:
              data.error ||
              tr(language, "Failed to create order", "创建订单失败"),
          });
          return;
        }
        const qrDataUrl = await QRCode.toDataURL(data.codeUrl, {
          width: 256,
          margin: 2,
        });
        if (cancelled) return;
        setState({
          phase: "awaiting",
          qrDataUrl,
          outTradeNo: data.outTradeNo,
          cnyFen: data.cnyFen,
        });
        startPolling(data.outTradeNo);
      } catch (e) {
        if (cancelled) return;
        setState({
          phase: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    init();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [amountCents, language, startPolling, stopPolling]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {tr(language, "WeChat Pay", "微信支付")}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="text-center">
          {state.phase === "loading" && (
            <div className="py-12">
              <div className="animate-spin inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                {tr(language, "Creating order…", "正在创建订单…")}
              </p>
            </div>
          )}

          {state.phase === "awaiting" && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                {tr(
                  language,
                  `Scan with WeChat to pay $${(amountCents / 100).toFixed(2)} (≈¥${(state.cnyFen / 100).toFixed(2)})`,
                  `用微信扫码支付 ¥${(state.cnyFen / 100).toFixed(2)}（约 $${(amountCents / 100).toFixed(2)}）`,
                )}
              </p>
              <img
                src={state.qrDataUrl}
                alt="WeChat Pay QR"
                className="mx-auto rounded border border-gray-200 dark:border-gray-700"
                width={256}
                height={256}
              />
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full" />
                {tr(
                  language,
                  "Waiting for payment…",
                  "等待支付完成…",
                )}
              </div>
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 break-all">
                {state.outTradeNo}
              </p>
            </>
          )}

          {state.phase === "success" && (
            <div className="py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
                {tr(language, "Payment successful!", "支付成功！")}
              </p>
            </div>
          )}

          {state.phase === "error" && (
            <div className="py-8">
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.message}
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {tr(language, "Close", "关闭")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
