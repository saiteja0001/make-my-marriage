import type { Metadata } from "next";
import { AccountPreview } from "../_components/account-preview";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return <AccountPreview mode="signup" />;
}
