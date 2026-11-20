import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { weddingTimeZones } from "@/modules/wedding/time-zones";
import { getSignedInUser } from "@/server/auth/session";
import { EditWeddingForm } from "./edit-wedding-form";

export const metadata: Metadata = { title: "Edit wedding details" };

export default async function EditWeddingPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");

  const { wedding, membership } = current;
  return (
    <EditWeddingForm
      key={`${user.id}:${wedding.id}`}
      accountId={user.id}
      weddingId={wedding.id}
      member={{ name: user.name, role: membership.role }}
      timeZones={weddingTimeZones(wedding.timeZone)}
      initial={{
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        location: wedding.location.formattedAddress,
        timeZone: wedding.timeZone,
        title: wedding.title ?? "",
        description: wedding.description ?? "",
      }}
    />
  );
}
