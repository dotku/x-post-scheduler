import { getAuthenticatedUser } from "@/lib/auth0";
import { redirect } from "next/navigation";
import LandingContent from "@/components/LandingContent";

export default async function LandingPage() {
  const user = await getAuthenticatedUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LandingContent />;
}
