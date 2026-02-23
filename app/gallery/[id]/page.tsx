import type { Metadata } from "next";
import GalleryDetailClient from "./detail-client";

export const metadata: Metadata = {
  title: "Gallery Detail | X Post Scheduler",
};

export default async function GalleryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GalleryDetailClient id={id} />;
}
