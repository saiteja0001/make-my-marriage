import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listEvents } from "@/modules/events/service";
import { photoDraftContext } from "@/modules/photos/service";
import { getWeddingForUser } from "@/modules/wedding/service";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceDraftShell } from "../_components/workspace-draft";
import { Gallery } from "./gallery";
import styles from "./gallery.module.css";

export const metadata: Metadata = { title: "Wedding Gallery" };

export default async function PhotosPage() {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");
  const { wedding, membership, membershipId } = current;
  const events = (await listEvents(wedding.id, { includeArchived: true })).map(({ id, name, archivedAt }) => ({
    id, name, archived: Boolean(archivedAt),
  }));
  return (
    <WorkspaceDraftShell currentPath="/app/photos" member={{ name: user.name, role: membership.role }}>
      <main className={styles.page}>
        <Gallery events={events} context={photoDraftContext({ membershipId, weddingId: wedding.id })}
          timeZone={wedding.timeZone} coupleNames={`${wedding.brideName} & ${wedding.groomName}`} />
      </main>
    </WorkspaceDraftShell>
  );
}
