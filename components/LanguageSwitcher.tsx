"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

export default function LanguageSwitcher() {
  const t = useTranslations("lang");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale() {
    const nextLocale = locale === "en" ? "zh" : "en";
    // Strip existing locale prefix then add new one
    const pathWithoutLocale = pathname.startsWith("/zh")
      ? pathname.slice(3) || "/"
      : pathname;
    const newPath = nextLocale === "zh" ? `/zh${pathWithoutLocale}` : pathWithoutLocale;
    startTransition(() => {
      router.push(newPath);
    });
  }

  return (
    <button
      onClick={switchLocale}
      disabled={isPending}
      className="text-sm text-gray-700 dark:text-gray-200 hover:underline underline-offset-4 disabled:opacity-50 font-medium"
      title="Switch language"
    >
      {t("switch")}
    </button>
  );
}
