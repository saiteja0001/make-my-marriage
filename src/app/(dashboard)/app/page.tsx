import { redirect } from "next/navigation";
import { getSignedInUser } from "@/server/auth/session";

export default async function WorkspacePage() {
  const user = await getSignedInUser();
  redirect(user ? "/onboarding" : "/login");
}
