import type { Metadata } from "next";
import GalleryClientPage from "./gallery-client";

export const metadata: Metadata = {
  title: "AI Gallery | xPilot",
};

export default function GalleryPage() {
  return <GalleryClientPage />;
}
