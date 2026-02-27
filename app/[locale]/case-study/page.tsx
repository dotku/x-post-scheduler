import { redirect } from "next/navigation";

export default async function CaseStudyPage({
  params,
}: {
  params: Promise<{ locale?: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "zh" ? "/zh" : "";
  redirect(`${prefix}/media-news`);
}
