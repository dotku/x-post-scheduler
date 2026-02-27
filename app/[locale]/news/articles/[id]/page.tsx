import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSourceArticleById, translateArticleForZh } from "@/lib/media-news";

export const revalidate = 86400; // 24h — article content & translation cached

type Props = {
  params: Promise<{ locale?: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const isZh = locale === "zh";
  const article = await getSourceArticleById(id);
  if (!article) return {};
  const sourceName = article.source.replace(/\s*\[(INDUSTRY|CONTEXT)\]/, "");

  if (isZh) {
    const zh = await translateArticleForZh(article.title, article.description);
    if (zh) {
      return {
        title: `${zh.titleZh} | ${sourceName} | xPilot`,
        description: zh.descriptionZh.slice(0, 160),
      };
    }
  }

  return {
    title: `${article.title} | ${sourceName} | xPilot`,
    description: article.description.slice(0, 160),
  };
}

function splitParagraphs(text: string): string[] {
  // Guardian bodyText can have mixed paragraph styles:
  // - \n\n between paragraphs (ideal)
  // - single \n used both as paragraph break AND as soft wrap within a paragraph
  //
  // Strategy:
  // 1. Collapse 3+ newlines → \n\n
  // 2. Split on double newlines → clean paragraphs
  // 3. Within each chunk, replace remaining single \n with space (they're soft wraps)
  // 4. If double-newline split yields ≤ 2 chunks, fall back to single-\n split
  //    but treat consecutive short lines (< 80 chars) as sentence continuations.

  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();

  let paras = normalized
    .split(/\n\n/)
    .map((chunk) => chunk.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter((p) => p.length > 0);

  if (paras.length <= 2) {
    // Fall back: split on every \n, skip blank / very short noise lines
    paras = normalized
      .split(/\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 25);
  }

  return paras;
}

export default async function ArticlePage({ params }: Props) {
  const { locale, id } = await params;
  const isZh = locale === "zh";
  const prefix = isZh ? "/zh" : "";

  const article = await getSourceArticleById(id);
  if (!article) notFound();

  const sourceName = article.source.replace(/\s*\[(INDUSTRY|CONTEXT)\]/, "");
  const paragraphsEn = article.fullContent ? splitParagraphs(article.fullContent) : [];

  // Fetch Chinese translation when in zh mode (cached by ISR)
  const zh = isZh && article.fullContent
    ? await translateArticleForZh(article.title, article.description, article.fullContent)
    : null;

  const displayTitle = zh?.titleZh ?? article.title;
  const displayDescription = zh?.descriptionZh ?? article.description;
  const displayParagraphs = zh?.paragraphsZh?.length ? zh.paragraphsZh : paragraphsEn;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
          <Link href={prefix || "/"} className="hover:text-gray-700 dark:hover:text-gray-200">
            {isZh ? "首页" : "Home"}
          </Link>
          <span>/</span>
          <Link href={`${prefix}/news`} className="hover:text-gray-700 dark:hover:text-gray-200">
            {isZh ? "传媒行业日报" : "Media Daily"}
          </Link>
          <span>/</span>
          <span className="text-gray-500 dark:text-gray-400 line-clamp-1">{sourceName}</span>
        </nav>

        <article className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
          {/* Cover image */}
          {article.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.image}
              alt={article.title}
              className="h-48 sm:h-64 w-full object-cover"
            />
          )}

          <div className="p-6 sm:p-8 space-y-6">
            {/* Meta */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  {sourceName}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {article.publishedAt}
                </span>
                {zh && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400">AI 译</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-snug">
                {displayTitle}
              </h1>
              {/* Show English title as subtitle when translated */}
              {zh && (
                <p className="mt-1.5 text-sm text-gray-400 dark:text-gray-500 leading-snug">
                  {article.title}
                </p>
              )}
            </div>

            {/* Lead / description */}
            <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed border-l-4 border-blue-200 dark:border-blue-800 pl-4 italic">
              {displayDescription}
            </p>

            {/* Full content */}
            {displayParagraphs.length > 0 ? (
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4">
                {displayParagraphs.map((para, i) => (
                  <p key={i} className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {isZh
                  ? "全文内容仅在原始信源提供，请点击下方链接阅读原文。"
                  : "Full content is only available at the original source. Click the link below to read more."}
              </p>
            )}

            {/* If translated, show collapsible English original */}
            {zh && paragraphsEn.length > 0 && (
              <details className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <summary className="px-5 py-3.5 bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 list-none flex items-center justify-between">
                  <span>English Original</span>
                  <span className="text-gray-300 dark:text-gray-500 text-base font-normal">▾</span>
                </summary>
                <div className="px-6 py-5 space-y-4 bg-white dark:bg-gray-800">
                  {/* English lead */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed border-l-4 border-gray-200 dark:border-gray-600 pl-4 italic">
                    {article.description}
                  </p>
                  <div className="space-y-4 pt-1">
                    {paragraphsEn.map((para, i) => (
                      <p key={i} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {/* Read original link */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isZh ? "阅读原文" : "Read original"} ↗
              </a>
              <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
              <span className="text-xs text-gray-400">{sourceName}</span>
            </div>
          </div>
        </article>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href={`${prefix}/news`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← {isZh ? "返回传媒行业日报" : "Back to Media Industry Daily"}
          </Link>
        </div>
      </div>
    </div>
  );
}
