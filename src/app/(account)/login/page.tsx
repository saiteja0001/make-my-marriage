import type { Metadata } from "next";
import { AccountPreview } from "../_components/account-preview";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AccountPreview mode="login" />;
}
