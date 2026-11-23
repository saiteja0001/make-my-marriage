import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getWeddingForUser } from "@/modules/wedding/service";
import { daysUntilWedding, formatWeddingDate } from "@/modules/wedding/wedding-date";
import { getSignedInUser } from "@/server/auth/session";
import { WorkspaceHeader } from "../_components/workspace-header";
import styles from "../workspace.module.css";
import { WeddingCountdown } from "./wedding-countdown";
import { WeddingUpdated } from "./wedding-updated";

export const metadata: Metadata = { title: "Your wedding" };

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const user = await getSignedInUser();
  if (!user) redirect("/login");
  const current = await getWeddingForUser(user.id);
  if (!current) redirect("/onboarding");

  const { membership, wedding } = current;
  const couple = `${wedding.brideName} & ${wedding.groomName}`;
  return (
    <>
      <WorkspaceHeader member={{ name: user.name, role: membership.role }} />
      <main className={styles.overview}>
        {(await searchParams).updated === "1" && <WeddingUpdated />}
        <section className={styles.overviewCard} aria-labelledby="wedding-heading">
          <div className={styles.overviewHeading}>
            <div>
              <p className={styles.overviewLabel}>Your wedding workspace</p>
              <div className={styles.overviewTitle}>
                <h1 id="wedding-heading">{wedding.title || couple}</h1>
                {/* A full navigation lets browser Back use the edit page's beforeunload guard. */}
                <a className={styles.editWedding} href="/app/edit">Edit wedding</a>
                <Link className={styles.editWedding} href="/app/members">Wedding members</Link>
              </div>
              {wedding.title && <p>{couple}</p>}
            </div>
            <WeddingCountdown
              weddingDate={wedding.weddingDate}
              timeZone={wedding.timeZone}
              initialDays={daysUntilWedding(wedding.weddingDate, wedding.timeZone)}
            />
          </div>
          <dl className={styles.overviewDetails}>
            <div>
              <dt>Wedding date</dt>
              <dd><time dateTime={wedding.weddingDate}>{formatWeddingDate(wedding.weddingDate)}</time></dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{wedding.location.formattedAddress}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{wedding.timeZone}</dd>
            </div>
          </dl>
          {wedding.description && <p className={styles.description}>{wedding.description}</p>}
        </section>
      </main>
    </>
  );
}
