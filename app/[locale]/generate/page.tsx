import { redirect } from "next/navigation";

export default async function GenerateRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const prefix = locale === "zh" ? "/zh" : "";
  redirect(`${prefix}/recurring`);
}
