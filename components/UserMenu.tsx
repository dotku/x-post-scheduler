"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { isVerifiedMember, getTierInfo } from "@/lib/subscription";

interface SubInfo {
  tier: string | null;
  status: string | null;
}

export default function UserMenu() {
  const t = useTranslations("userMenu");
  const locale = useLocale();
  const { user, isLoading } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const prefix = locale === "zh" ? "/zh" : "";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/me/subscription")
      .then((r) => r.json())
      .then((d) => setSub({ tier: d.tier, status: d.status }))
      .catch(() => {});
  }, [user]);

  const verified = isVerifiedMember(sub?.tier, sub?.status);
  const tierInfo = sub?.tier ? getTierInfo(sub.tier) : null;
  const tierLabel = tierInfo
    ? locale === "zh"
      ? tierInfo.labelZh
      : tierInfo.label
    : null;
  const tierBadgeText = tierLabel ? tierLabel.charAt(0).toUpperCase() : null;

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none"
      >
        <span className="relative inline-flex">
          {user.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.picture}
              alt={user.name || "User"}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
          )}
          {verified && tierBadgeText && (
            <span
              className="absolute -bottom-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white"
              title={
                locale === "zh" ? `${tierLabel}认证会员` : `${tierLabel} Member`
              }
            >
              {tierBadgeText}
            </span>
          )}
        </span>
        <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300">
          {user.name || user.email}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </p>
            {verified && tierInfo && (
              <p className="text-xs text-blue-500 font-medium mt-0.5">
                ✓ {locale === "zh" ? tierInfo.labelZh : tierInfo.label}{" "}
                {locale === "zh" ? "认证会员" : "Member"}
              </p>
            )}
          </div>
          <Link
            href={`${prefix}/settings`}
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t("settings")}
          </Link>
          <a
            href="/auth/logout"
            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t("signOut")}
          </a>
        </div>
      )}
    </div>
  );
}
