import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasWeddingMembership } from "@/modules/wedding/service";
import { defaultWeddingTimeZone } from "@/modules/wedding/validation";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceHeader } from "../_components/workspace-header";
import { WeddingOnboarding } from "./wedding-onboarding";

export const metadata: Metadata = { title: "Wedding setup" };

const timeZones = [
  defaultWeddingTimeZone,
  "UTC",
  ...Intl.supportedValuesOf("timeZone").filter(
    (zone) => zone !== defaultWeddingTimeZone && zone !== "Asia/Calcutta",
  ),
];

export default async function OnboardingPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  if (await hasWeddingMembership(user.id)) redirect("/app");

  return (
    <>
      <WorkspaceHeader />
      <WeddingOnboarding key={user.id} draftAccountId={user.id} timeZones={timeZones} />
    </>
  );
}
