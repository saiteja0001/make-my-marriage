import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionLink } from "@/components/ui/action-link";
import { getSignedInUser } from "@/server/auth/session";
import { LogoutButton } from "../_components/logout-button";

export const metadata: Metadata = { title: "Wedding setup" };

export default async function OnboardingPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");

  return (
    <section className="panel p-6 sm:p-9">
      <h1 className="font-display text-4xl tracking-tight text-pine">Welcome, {user.name}</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Your account is ready. You can explore the demo while wedding setup is being built.
      </p>
      <div className="mt-6 flex flex-wrap items-start gap-3">
        <ActionLink href="/demo">Explore the demo</ActionLink>
        <LogoutButton />
      </div>
    </section>
  );
}
