import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignedInUser } from "@/server/auth/session";
import { AccountForm } from "../_components/account-form";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getSignedInUser()) redirect("/app");
  return <AccountForm mode="signup" />;
}
